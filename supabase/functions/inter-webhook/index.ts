import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const webhookData = await req.json();
    console.log("Inter Webhook recebido:", JSON.stringify(webhookData, null, 2));

    // Log the webhook
    await supabaseClient.from("inter_logs").insert({
      company_id: "00000000-0000-0000-0000-000000000000", // Will need to identify company from webhook data
      operation_type: "webhook",
      status: "received",
      request_data: webhookData,
      response_data: { received_at: new Date().toISOString() },
    });

    // Process webhook based on type
    if (webhookData.evento) {
      console.log("Evento Inter:", webhookData.evento);

      // Handle different event types
      switch (webhookData.evento) {
        case "PAGAMENTO_BOLETO_CONFIRMADO":
          console.log("Pagamento de boleto confirmado:", webhookData.nossoNumero);
          // Update payment status in database
          break;

        case "BAIXA_BOLETO_EFETIVADA":
          console.log("Baixa de boleto efetivada:", webhookData.nossoNumero);
          break;

        case "PIX_RECEBIDO":
          console.log("PIX recebido:", webhookData.txid);
          break;

        default:
          console.log("Evento desconhecido:", webhookData.evento);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processado" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro ao processar webhook Inter:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
