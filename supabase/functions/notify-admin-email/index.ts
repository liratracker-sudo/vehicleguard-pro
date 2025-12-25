import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || 'https://gestaotracker.lovable.app';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyAdminRequest {
  company_id: string;
  alert_type: 'whatsapp_disconnected' | 'ai_failure' | 'billing_error';
  context?: {
    instance_name?: string;
    error_message?: string;
    client_name?: string;
  };
}

// Rate limit: 1 email por tipo de alerta por empresa a cada 6 horas
const RATE_LIMIT_HOURS = 6;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, alert_type, context }: NotifyAdminRequest = await req.json();
    
    console.log(`📧 [notify-admin-email] Processing alert: ${alert_type} for company ${company_id}`);
    
    if (!company_id || !alert_type) {
      throw new Error('company_id e alert_type são obrigatórios');
    }
    
    // 1. Verificar rate limit - não enviar se já enviou nas últimas 6 horas
    const sixHoursAgo = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000).toISOString();
    
    const { data: recentNotification } = await supabase
      .from('admin_notification_logs')
      .select('id, created_at')
      .eq('company_id', company_id)
      .eq('notification_type', alert_type)
      .gte('created_at', sixHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (recentNotification) {
      console.log(`⏭️ Rate limited: Already sent ${alert_type} email at ${recentNotification.created_at}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'rate_limited',
          last_sent: recentNotification.created_at 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // 2. Buscar dados da empresa e admin
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, slug, logo_url')
      .eq('id', company_id)
      .single();
    
    if (companyError || !company) {
      throw new Error(`Empresa não encontrada: ${companyError?.message}`);
    }
    
    // Buscar o admin (role = 'admin') da empresa
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('company_id', company_id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    if (adminError || !adminProfile?.email) {
      console.error(`❌ Admin não encontrado para empresa ${company_id}:`, adminError?.message);
      throw new Error('Admin não encontrado para esta empresa');
    }
    
    console.log(`📧 Found admin: ${adminProfile.full_name} (${adminProfile.email})`);
    console.log(`🖼️ Company logo: ${company.logo_url || 'none'}`);
    
    // 3. Gerar conteúdo do email baseado no tipo de alerta
    const { subject, html } = generateEmailContent(alert_type, company.name, context, appUrl, company.logo_url);
    
    // 4. Enviar email via Resend
    console.log(`📤 Sending email to ${adminProfile.email}...`);
    
    const emailResponse = await resend.emails.send({
      from: "GestaoTracker <alertas@resend.dev>",
      to: [adminProfile.email],
      subject: subject,
      html: html,
    });
    
    console.log("✅ Email sent successfully:", emailResponse);
    
    // 5. Registrar envio no log (para rate limiting)
    const { error: logError } = await supabase
      .from('admin_notification_logs')
      .insert({
        company_id: company_id,
        notification_type: alert_type,
        sent_via: 'email',
        recipient: adminProfile.email,
        subject: subject,
        message: `Alert sent to ${adminProfile.full_name}`
      });
    
    if (logError) {
      console.error('⚠️ Failed to log notification:', logError.message);
      // Não falhar por causa disso
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailResponse.id,
        recipient: adminProfile.email 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
    
  } catch (error: any) {
    console.error("❌ Error in notify-admin-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function generateEmailContent(
  alertType: string, 
  companyName: string, 
  context?: NotifyAdminRequest['context'],
  appUrl?: string,
  logoUrl?: string | null
): { subject: string; html: string } {
  const settingsUrl = `${appUrl}/settings?tab=integracoes`;
  
  // Logo HTML - usa logo da empresa ou fallback para texto
  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px; margin-bottom: 15px; object-fit: contain;">`
    : `<div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: white;">GestaoTracker</div>`;
  
  switch (alertType) {
    case 'whatsapp_disconnected':
      return {
        subject: `⚠️ WhatsApp desconectado - ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              ${logoHtml}
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Alerta: WhatsApp Desconectado</h1>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Olá! O sistema detectou que o WhatsApp da sua empresa <strong>${companyName}</strong> foi desconectado.
              </p>
              
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b;">
                  <strong>🚫 Impacto:</strong> As notificações automáticas de cobrança estão pausadas até que você reconecte o WhatsApp.
                </p>
              </div>
              
              ${context?.error_message ? `
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
                  <strong>Detalhes técnicos:</strong> ${context.error_message}
                </p>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${settingsUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  🔗 Reconectar WhatsApp
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                <strong>Como reconectar:</strong><br>
                1. Clique no botão acima<br>
                2. Vá para a seção "Integrações"<br>
                3. Clique em "Reconectar" no card do WhatsApp<br>
                4. Escaneie o QR Code com seu celular
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Este é um email automático do sistema GestaoTracker.<br>
                Você só receberá um novo alerta deste tipo após 6 horas.
              </p>
            </div>
          </body>
          </html>
        `
      };
      
    case 'ai_failure':
      return {
        subject: `⚠️ Falha no sistema de IA - ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              ${logoHtml}
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Alerta: Falha no Sistema de IA</h1>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                O sistema de IA encontrou um problema ao gerar mensagens de cobrança para <strong>${companyName}</strong>.
              </p>
              
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e;">
                  <strong>ℹ️ Não se preocupe:</strong> O sistema usou mensagens padrão como fallback. Suas cobranças continuaram sendo enviadas.
                </p>
              </div>
              
              ${context?.error_message ? `
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Erro:</strong> ${context.error_message}
                </p>
              ` : ''}
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Email automático do GestaoTracker. Próximo alerta em 6 horas.
              </p>
            </div>
          </body>
          </html>
        `
      };
      
    default:
      return {
        subject: `⚠️ Alerta do sistema - ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              ${logoHtml}
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Alerta do Sistema</h1>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Foi detectado um problema no sistema da empresa <strong>${companyName}</strong>.
              </p>
              <p style="font-size: 16px;">
                Por favor, acesse o sistema para verificar.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Email automático do GestaoTracker.
              </p>
            </div>
          </body>
          </html>
        `
      };
  }
}
