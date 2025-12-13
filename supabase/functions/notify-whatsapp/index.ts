import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://mcdidffxwtnqhawqilln.supabase.co';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Utility: normalize BR phone numbers to WhatsApp format (only digits, with country code 55)
function normalizeBrazilPhone(phone: string): string | null {
  if (!phone) return null;
  // Keep digits only
  let p = phone.replace(/\D/g, '');
  // Remove leading zeros
  p = p.replace(/^0+/, '');
  // If already starts with 55, keep as is
  if (p.startsWith('55')) return p;
  // If it looks like local (10-11 digits), prefix country code
  if (p.length === 10 || p.length === 11) return '55' + p;
  // If has 12-13 digits but missing 55, add it
  if (p.length >= 12 && p.length <= 13) return p.startsWith('55') ? p : '55' + p;
  // Fallback: return digits (may still fail at provider)
  return p;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create a Supabase client with the incoming user's JWT for RLS
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const body = await req.json();
    const { client_id, message, payment_id, schedule_for, phone, linkPreview } = body as {
      client_id: string;
      message: string;
      payment_id?: string;
      schedule_for?: string; // ISO string for future scheduling
      phone?: string;
      linkPreview?: boolean; // Controla preview de link no WhatsApp
    };

    if (!client_id || !message) {
      console.error('notify-whatsapp validation: missing client_id or message');
      return new Response(
        JSON.stringify({ success: false, error: 'client_id e message são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user and company
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      console.error('notify-whatsapp auth: usuário não autenticado');
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.company_id) {
      console.error('notify-whatsapp validation: perfil/empresa não encontrado');
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil/empresa não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const company_id = profile.company_id as string;

    // Fetch client for phone when not provided AND check whatsapp status
    let targetPhone = phone ?? null as string | null;
    let clientId = client_id;
    
    // 🛡️ VERIFICAÇÃO ANTI-SPAM: Checar opt-out e bloqueio do cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('phone, whatsapp_opt_out, whatsapp_blocked, whatsapp_block_reason, whatsapp_failures')
      .eq('id', client_id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (clientData?.whatsapp_opt_out) {
      console.log(`⛔ Cliente ${client_id} optou por não receber WhatsApp (opt-out)`);
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente optou por não receber WhatsApp', opt_out: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clientData?.whatsapp_blocked) {
      console.log(`🚫 Cliente ${client_id} está bloqueado: ${clientData.whatsapp_block_reason}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Número bloqueado por falhas consecutivas', blocked: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetPhone) {
      targetPhone = clientData?.phone ?? null;
    }

    if (!targetPhone) {
      console.error('notify-whatsapp validation: telefone do cliente não encontrado');
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone do cliente não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone for WhatsApp Evolution (digits only + country code 55)
    const normalizedPhone = normalizeBrazilPhone(targetPhone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      console.error('notify-whatsapp validation: telefone inválido após normalização', { targetPhone, normalizedPhone });
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone inválido para WhatsApp' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scheduling path: just create a payment_notifications pending entry
    if (schedule_for && new Date(schedule_for).getTime() > Date.now()) {
      // Use service role to bypass RLS for notifications
      const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { error: insErr } = await supabaseService
        .from('payment_notifications')
        .insert({
          company_id,
          client_id,
          payment_id: payment_id ?? null,
          event_type: 'manual',
          offset_days: 0,
          scheduled_for: schedule_for,
          status: 'pending',
          message_body: message,
        });

      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({ success: true, scheduled: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Immediate send path: get WhatsApp settings
    const { data: whatsappSettings } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!whatsappSettings) {
      console.error('notify-whatsapp validation: configurações do WhatsApp não encontradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações do WhatsApp não encontradas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via central whatsapp-evolution function
    const sendRes = await supabase.functions.invoke('whatsapp-evolution', {
      body: {
        action: 'send_message',
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name,
        phone_number: normalizedPhone,
        message,
        company_id,
        client_id,
        linkPreview: linkPreview !== undefined ? linkPreview : true, // Passa o parâmetro
      },
    });

    const ok = !sendRes.error && (sendRes.data?.success ?? true);
    const errMsg = ok ? null : (sendRes.error?.message || (sendRes.data && (sendRes.data.error || (typeof sendRes.data === 'string' ? sendRes.data : JSON.stringify(sendRes.data)))) || 'Falha ao enviar via Evolution API');

    // 🛡️ ANTI-SPAM: Atualizar contador de falhas do cliente
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    if (!ok && clientData) {
      const newFailures = (clientData.whatsapp_failures || 0) + 1;
      console.log(`📊 Cliente ${client_id}: falha #${newFailures}`);
      
      const updateData: Record<string, any> = { whatsapp_failures: newFailures };
      
      // Bloquear após 3 falhas consecutivas
      if (newFailures >= 3) {
        updateData.whatsapp_blocked = true;
        updateData.whatsapp_block_reason = `Bloqueado automaticamente após ${newFailures} falhas: ${errMsg}`;
        console.log(`🚫 Bloqueando cliente ${client_id} após ${newFailures} falhas consecutivas`);
      }
      
      await supabaseService
        .from('clients')
        .update(updateData)
        .eq('id', client_id);
    } else if (ok && clientData && clientData.whatsapp_failures > 0) {
      // Sucesso: resetar contador de falhas
      console.log(`✅ Cliente ${client_id}: mensagem enviada, resetando contador de falhas`);
      await supabaseService
        .from('clients')
        .update({ whatsapp_failures: 0 })
        .eq('id', client_id);
    }

    // Record into payment_notifications when tied to a payment
    if (payment_id) {
      await supabaseService.from('payment_notifications').insert({
        company_id,
        client_id,
        payment_id,
        event_type: 'manual',
        offset_days: 0,
        scheduled_for: new Date().toISOString(),
        status: ok ? 'sent' : 'failed',
        sent_at: ok ? new Date().toISOString() : null,
        attempts: 1,
        message_body: message,
        last_error: ok ? null : (sendRes.error?.message ?? JSON.stringify(sendRes.data ?? {})),
      });
    }

    return new Response(
      JSON.stringify({ success: ok, error: ok ? null : errMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('notify-whatsapp error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});