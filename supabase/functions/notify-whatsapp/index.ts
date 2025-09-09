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
    const { client_id, message, payment_id, schedule_for, phone } = body as {
      client_id: string;
      message: string;
      payment_id?: string;
      schedule_for?: string; // ISO string for future scheduling
      phone?: string;
    };

    if (!client_id || !message) {
      return new Response(
        JSON.stringify({ error: 'client_id e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user and company
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'Perfil/empresa não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const company_id = profile.company_id as string;

    // Fetch client for phone when not provided
    let targetPhone = phone ?? null as string | null;
    if (!targetPhone) {
      const { data: client } = await supabase
        .from('clients')
        .select('phone')
        .eq('id', client_id)
        .eq('company_id', company_id)
        .maybeSingle();
      targetPhone = client?.phone ?? null;
    }

    if (!targetPhone) {
      return new Response(
        JSON.stringify({ error: 'Telefone do cliente não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'Configurações do WhatsApp não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via central whatsapp-evolution function
    const sendRes = await supabase.functions.invoke('whatsapp-evolution', {
      body: {
        action: 'send_message',
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name,
        phone_number: targetPhone,
        message,
        company_id,
        client_id,
      },
    });

    const ok = !sendRes.error && (sendRes.data?.success ?? true);

    // Record into payment_notifications when tied to a payment
    if (payment_id) {
      // Use service role to bypass RLS for notifications
      const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
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
      JSON.stringify({ success: ok }),
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