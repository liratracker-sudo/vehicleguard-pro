import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility: normalize BR phone numbers to WhatsApp format
function normalizeBrazilPhone(phone: string): string | null {
  if (!phone) return null
  let p = phone.replace(/\D/g, '')
  p = p.replace(/^0+/, '')
  if (p.startsWith('55')) return p
  if (p.length === 10 || p.length === 11) return '55' + p
  if (p.length >= 12 && p.length <= 13) return p.startsWith('55') ? p : '55' + p
  return p
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { company_id, registration_id, registration_name } = await req.json()

    console.log('Notifying admin about new registration:', { company_id, registration_id, registration_name })

    // Buscar configurações do WhatsApp da empresa
    const { data: whatsappSettings, error: whatsappError } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .maybeSingle()

    if (whatsappError || !whatsappSettings) {
      console.log('WhatsApp not configured for company, skipping notification')
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'WhatsApp not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar perfis de admins da empresa
    const { data: adminProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('company_id', company_id)
      .eq('role', 'admin')
      .not('phone', 'is', null)

    if (profilesError || !adminProfiles || adminProfiles.length === 0) {
      console.log('No admin phones found for company')
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No admin phones found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mensagem para os admins
    const message = `🔔 *Novo Cadastro de Cliente*\n\n` +
      `Nome: ${registration_name}\n` +
      `ID: ${registration_id.slice(0, 8).toUpperCase()}\n\n` +
      `Acesse o sistema para revisar e aprovar o cadastro.`

    // Enviar notificação para cada admin
    const notificationResults = []
    for (const admin of adminProfiles) {
      if (!admin.phone) continue

      const normalizedPhone = normalizeBrazilPhone(admin.phone)
      if (!normalizedPhone) {
        console.log('Invalid phone for admin:', admin.full_name)
        continue
      }

      console.log('Sending notification to admin:', admin.full_name, normalizedPhone)

      try {
        const sendRes = await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'send_message',
            instance_url: whatsappSettings.instance_url,
            api_token: whatsappSettings.api_token,
            instance_name: whatsappSettings.instance_name,
            phone_number: normalizedPhone,
            message,
            company_id,
          },
        })

        notificationResults.push({
          admin: admin.full_name,
          phone: normalizedPhone,
          success: !sendRes.error,
          error: sendRes.error?.message
        })
      } catch (error) {
        console.error('Error sending to admin:', admin.full_name, error)
        notificationResults.push({
          admin: admin.full_name,
          phone: normalizedPhone,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notificationResults.filter(r => r.success).length,
        results: notificationResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-registration-admin:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao notificar admin'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})