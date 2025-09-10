import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers as recommended by Supabase
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility: safe JSON parsing with basic validation
async function parseJson<T = any>(req: Request): Promise<T> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Conteúdo inválido. O webhook do Autentique envia JSON (Content-Type: application/json). ");
  }
  return await req.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const payload = await parseJson<any>(req);
    const event = payload?.event;

    if (!event || !event.type) {
      return new Response(JSON.stringify({ error: "Evento inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType: string = event.type;
    console.log("[autentique-webhook] received:", eventType, "id:", event.id);

    // Extract document id and relevant data from known event types
    let documentId: string | undefined;
    let signedAt: string | undefined;
    let signedFileUrl: string | undefined;
    let setAsSigned = false;

    if (eventType.startsWith("signature.")) {
      // signature.* events carry a signature object in event.data
      const signature = event.data as any; // object: "signature"
      documentId = signature?.document as string | undefined;
      signedAt = signature?.signed as string | undefined;

      if (eventType === "signature.accepted") {
        setAsSigned = true; // In our app, we currently create documents with 1 signatário
      }
    } else if (eventType === "document.updated") {
      const docObj = (event.data?.object ?? {}) as any; // object: "document"
      documentId = docObj?.id as string | undefined;

      // If all required signatures are completed, mark as signed
      const total = Number(docObj?.signatures_count ?? 0);
      const signed = Number(docObj?.signed_count ?? 0);
      if (total > 0 && signed >= total) {
        setAsSigned = true;
        signedFileUrl = docObj?.files?.signed as string | undefined;
        // updated_at could be used as a proxy when signed timestamp isn't present here
        signedAt = docObj?.updated_at as string | undefined;
      }
    }

    if (!documentId) {
      console.warn("[autentique-webhook] no document id found in event");
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update payload for our contracts table
    const updateData: Record<string, any> = {};
    if (setAsSigned) {
      updateData.signature_status = "signed";
      if (signedAt) updateData.signed_at = new Date(signedAt).toISOString();
      if (signedFileUrl) updateData.document_url = signedFileUrl;
    }

    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("autentique_document_id", documentId)
        .select("id, company_id, client_id");

      if (error) {
        console.error("[autentique-webhook] DB update error:", error);
      } else {
        console.log("[autentique-webhook] updated contracts:", data?.map((r: any) => r.id));
      }
    } else {
      console.log("[autentique-webhook] no state change required for event", eventType);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[autentique-webhook] error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "Invalid payload", details: String(err?.message || err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
