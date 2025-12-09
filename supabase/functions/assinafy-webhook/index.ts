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
  console.log("[assinafy-webhook] 🚀 Webhook called");
  
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
    console.log("[assinafy-webhook] 📋 Full payload received:", JSON.stringify(payload, null, 2));
    
    const event = payload?.event || payload;

    if (!event) {
      console.error("[assinafy-webhook] ❌ Invalid event received - no event object");
      return new Response(JSON.stringify({ error: "Evento inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType: string = event.type || payload.type || 'unknown';
    console.log("[assinafy-webhook] 📨 Event type:", eventType);

    // Extract document id and relevant data from known event types
    let documentId: string | undefined;
    let signedAt: string | undefined;
    let signedFileUrl: string | undefined;
    let setAsSigned = false;

    // Assinafy webhook events structure - support multiple event formats
    const docObj = event.data || event || {};
    console.log("[assinafy-webhook] 📄 Document object:", JSON.stringify(docObj, null, 2));
    
    // Extract document ID from various possible locations
    documentId = docObj.document_id || docObj.id || event.document_id || payload.document_id;
    console.log("[assinafy-webhook] 🔑 Document ID found:", documentId);
    
    // Check various event types and statuses that indicate signing completion
    // IMPORTANTE: Incluir "document_ready" que é o evento enviado pela Assinafy quando documento é assinado
    const completionEvents = [
      "document.signed",
      "document_ready",          // Evento principal da Assinafy quando documento é assinado
      "document.ready",          // Variante com ponto
      "assignment.completed", 
      "document.certificated",
      "document.status_changed",
      "assignment.status_changed",
      "document.completed"       // Outra variante possível
    ];
    
    const completionStatuses = ["certificated", "completed", "signed", "ready"];
    
    // Verificar se é um evento de conclusão
    const isCompletionEvent = completionEvents.includes(eventType);
    console.log("[assinafy-webhook] 🔍 Is completion event:", isCompletionEvent, "| Event type:", eventType);
    
    if (isCompletionEvent) {
      console.log("[assinafy-webhook] ✅ Completion event detected, checking status...");
      
      // Check status in various locations
      const status = docObj.status || event.status || payload.status;
      console.log("[assinafy-webhook] 📊 Document status:", status);
      
      // Se é document_ready, consideramos como assinado independente do status
      if (eventType === "document_ready" || eventType === "document.ready") {
        setAsSigned = true;
        signedFileUrl = docObj.artifacts?.certificated || docObj.download_url || docObj.signed_url || docObj.file_url;
        signedAt = docObj.completed_at || docObj.updated_at || docObj.signed_at || new Date().toISOString();
        console.log("[assinafy-webhook] ✅ Document ready event - marking as signed!");
      } else if (completionStatuses.includes(status)) {
        setAsSigned = true;
        signedFileUrl = docObj.artifacts?.certificated || docObj.download_url || docObj.signed_url;
        signedAt = docObj.completed_at || docObj.updated_at || docObj.signed_at || new Date().toISOString();
        console.log("[assinafy-webhook] ✅ Document marked as signed based on status!");
      }
    }

    if (!documentId) {
      console.warn("[assinafy-webhook] ⚠️ No document ID found in event");
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "no_document_id" }), {
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
      console.log("[assinafy-webhook] 📝 Updating contracts with data:", updateData);
      
      const { data, error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("assinafy_document_id", documentId)
        .select("id, company_id, client_id");

      if (error) {
        console.error("[assinafy-webhook] ❌ DB update error:", error);
        
        // Log the error
        await supabase.from('assinafy_logs').insert({
          company_id: data?.[0]?.company_id,
          operation_type: 'webhook',
          status: 'error',
          request_data: { event: eventType, document_id: documentId },
          error_message: error.message
        });
      } else {
        console.log("[assinafy-webhook] ✅ Updated contracts:", data?.map((r: any) => r.id));
        
        // Log successful webhook processing
        if (data && data.length > 0) {
          await supabase.from('assinafy_logs').insert({
            company_id: data[0].company_id,
            contract_id: data[0].id,
            operation_type: 'webhook',
            status: 'success',
            request_data: { event: eventType, document_id: documentId },
            response_data: { update_data: updateData }
          });
          
          // Send WhatsApp notification when document is signed
          for (const contract of data) {
            await sendWhatsAppNotifications(supabase, contract, documentId);
          }
        }
      }
    } else {
      console.log("[assinafy-webhook] ℹ️ No state change required for event", eventType);
    }

    return new Response(JSON.stringify({ ok: true, processed: setAsSigned }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[assinafy-webhook] ❌ Error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "Invalid payload", details: String(err?.message || err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Função separada para enviar notificações WhatsApp
async function sendWhatsAppNotifications(
  supabase: any, 
  contract: { id: string; company_id: string; client_id: string },
  documentId: string
) {
  try {
    console.log("[assinafy-webhook] 📱 Sending WhatsApp notifications for contract:", contract.id);
    
    // Buscar configurações do WhatsApp da empresa
    const { data: whatsappSettings } = await supabase
      .from("whatsapp_settings")
      .select("instance_url, instance_name, api_token, is_active, connection_status")
      .eq("company_id", contract.company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!whatsappSettings) {
      console.log("[assinafy-webhook] ⚠️ WhatsApp not configured for company:", contract.company_id);
      return;
    }

    if (whatsappSettings.connection_status !== 'connected') {
      console.log("[assinafy-webhook] ⚠️ WhatsApp not connected for company:", contract.company_id);
      return;
    }

    console.log("[assinafy-webhook] ✅ WhatsApp configured and connected");

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone")
      .eq("id", contract.client_id)
      .single();

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name, phone")
      .eq("id", contract.company_id)
      .single();

    if (client && client.phone) {
      const clientMessage = `✅ Parabéns ${client.name}!\n\nSeu contrato foi assinado com sucesso! 🎉\n\nVocê receberá uma cópia do documento assinado em breve.\n\nObrigado pela confiança!`;
      
      try {
        await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'send_message',
            instance_url: whatsappSettings.instance_url,
            api_token: whatsappSettings.api_token,
            instance_name: whatsappSettings.instance_name,
            phone_number: client.phone,
            message: clientMessage,
            company_id: contract.company_id,
            client_id: contract.client_id
          }
        });
        console.log("[assinafy-webhook] ✅ WhatsApp sent to client:", client.phone);
      } catch (whatsappError) {
        console.error("[assinafy-webhook] ❌ WhatsApp error (client):", whatsappError);
      }
    } else {
      console.log("[assinafy-webhook] ⚠️ Client has no phone:", contract.client_id);
    }
  } catch (error) {
    console.error("[assinafy-webhook] ❌ Error sending WhatsApp notifications:", error);
  }
}
