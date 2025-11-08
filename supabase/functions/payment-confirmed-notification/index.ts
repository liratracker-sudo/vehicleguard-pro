import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility: normalize BR phone numbers to WhatsApp format
function normalizeBrazilPhone(phone: string): string | null {
  if (!phone) return null;
  let p = phone.replace(/\D/g, '');
  p = p.replace(/^0+/, '');
  if (p.startsWith('55')) return p;
  if (p.length === 10 || p.length === 11) return '55' + p;
  if (p.length >= 12 && p.length <= 13) return p.startsWith('55') ? p : '55' + p;
  return p;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id } = await req.json();
    
    console.log('🔔 Payment confirmation notification triggered for:', payment_id);

    if (!payment_id) {
      throw new Error('payment_id é obrigatório');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar dados completos do pagamento
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients!inner(id, name, phone, email),
        companies!inner(id, name)
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment not found:', paymentError);
      throw new Error('Pagamento não encontrado');
    }

    // Verificar se o pagamento foi realmente confirmado
    if (payment.status !== 'paid') {
      console.log('⚠️ Payment status is not paid, skipping notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Status não é paid, notificação não enviada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = payment.clients;
    const company = payment.companies;

    // Verificar se cliente tem telefone
    if (!client?.phone) {
      console.error('❌ Client has no phone number');
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente não possui telefone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações de notificação da empresa
    const { data: notificationSettings } = await supabase
      .from('payment_notification_settings')
      .select('*')
      .eq('company_id', payment.company_id)
      .eq('active', true)
      .maybeSingle();

    // Verificar se notificações estão ativas
    if (!notificationSettings?.on_paid) {
      console.log('⚠️ Payment confirmation notifications are disabled for this company');
      return new Response(
        JSON.stringify({ success: true, message: 'Notificações de pagamento confirmado desativadas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações do WhatsApp
    const { data: whatsappSettings } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', payment.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!whatsappSettings) {
      console.error('❌ WhatsApp settings not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações do WhatsApp não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone
    const normalizedPhone = normalizeBrazilPhone(client.phone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      console.error('❌ Invalid phone number:', client.phone);
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir mensagem de confirmação
    const message = `🎉 *Pagamento Confirmado!*

Olá, ${client.name}!

Confirmamos o recebimento do seu pagamento de *R$ ${payment.amount.toFixed(2)}*.

✅ Status: *PAGO*
📅 Data: ${new Date().toLocaleDateString('pt-BR')}
🏢 Empresa: ${company.name}

Obrigado pela sua confiança! 💚

${payment.description ? `\n📝 Referência: ${payment.description}` : ''}`;

    console.log('📤 Sending WhatsApp notification to:', normalizedPhone);

    // Enviar mensagem via WhatsApp Evolution
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-evolution', {
      body: {
        action: 'send_message',
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name,
        phone_number: normalizedPhone,
        message,
        company_id: payment.company_id,
        client_id: client.id,
      },
    });

    if (sendError) {
      console.error('❌ Error sending WhatsApp:', sendError);
      throw sendError;
    }

    const success = sendResult?.success ?? true;

    // Registrar notificação no histórico
    await supabase.from('payment_notifications').insert({
      company_id: payment.company_id,
      client_id: client.id,
      payment_id: payment.id,
      event_type: 'on_paid',
      offset_days: 0,
      scheduled_for: new Date().toISOString(),
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
      attempts: 1,
      message_body: message,
      last_error: success ? null : JSON.stringify(sendResult),
    });

    console.log('✅ Payment confirmation notification sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação de pagamento confirmado enviada com sucesso',
        phone: normalizedPhone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in payment-confirmed-notification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
