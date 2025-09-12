import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility: safe JSON parsing with validation
async function parseJson<T = any>(req: Request): Promise<T> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Conteúdo inválido. O webhook da Assinafy envia JSON (Content-Type: application/json).");
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
    console.log("[assinafy-webhook] received:", eventType, "id:", event.id);

    // Extract document id and relevant data from known event types
    let documentId: string | undefined;
    let signedAt: string | undefined;
    let signedFileUrl: string | undefined;
    let setAsSigned = false;

    // Assinafy webhook events structure
    if (eventType === "document.signed" || eventType === "assignment.completed") {
      const docObj = event.data || {};
      documentId = docObj.document_id || docObj.id;
      
      // Check if document is fully signed
      if (docObj.status === "certificated" || docObj.status === "completed") {
        setAsSigned = true;
        signedFileUrl = docObj.artifacts?.certificated || docObj.download_url;
        signedAt = docObj.completed_at || docObj.updated_at;
      }
    } else if (eventType === "document.status_changed") {
      const docObj = event.data || {};
      documentId = docObj.id;
      
      if (docObj.status === "certificated") {
        setAsSigned = true;
        signedFileUrl = docObj.artifacts?.certificated;
        signedAt = docObj.updated_at;
      }
    }

    if (!documentId) {
      console.warn("[assinafy-webhook] no document id found in event");
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
        .eq("assinafy_document_id", documentId)
        .select("id, company_id, client_id");

      if (error) {
        console.error("[assinafy-webhook] DB update error:", error);
      } else {
        console.log("[assinafy-webhook] updated contracts:", data?.map((r: any) => r.id));
      }
    } else {
      console.log("[assinafy-webhook] no state change required for event", eventType);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[assinafy-webhook] error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "Invalid payload", details: String(err?.message || err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});