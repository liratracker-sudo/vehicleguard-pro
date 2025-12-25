import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReengagementRequest {
  company_ids?: string[]; // Se vazio, envia para todas empresas inativas
  min_days_inactive?: number; // Mínimo de dias desde cadastro (default: 3)
  template_type?: string; // Tipo de template (default: 'first_reminder')
  dry_run?: boolean; // Se true, apenas lista empresas sem enviar
}

interface InactiveCompany {
  id: string;
  name: string;
  email: string | null;
  admin_name: string | null;
  admin_email: string | null;
  created_at: string;
  days_since_signup: number;
  already_sent: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      company_ids, 
      min_days_inactive = 3, 
      template_type = 'first_reminder',
      dry_run = false 
    }: ReengagementRequest = await req.json();

    console.log(`📧 Reengagement email request - dry_run: ${dry_run}, min_days: ${min_days_inactive}`);

    // Buscar empresas inativas (0 clientes, 0 veículos, 0 contratos)
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        email,
        created_at,
        clients(count),
        vehicles(count),
        contracts(count)
      `)
      .eq('is_active', true);

    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    // Filtrar empresas inativas
    const inactiveCompanies: InactiveCompany[] = [];
    
    for (const company of companies || []) {
      const clientCount = company.clients?.[0]?.count || 0;
      const vehicleCount = company.vehicles?.[0]?.count || 0;
      const contractCount = company.contracts?.[0]?.count || 0;
      
      // Só considera inativa se não tem nenhum dado
      if (clientCount === 0 && vehicleCount === 0 && contractCount === 0) {
        const daysSinceSignup = Math.floor(
          (Date.now() - new Date(company.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Filtrar por dias mínimos
        if (daysSinceSignup >= min_days_inactive) {
          // Filtrar por IDs específicos se fornecidos
          if (company_ids && company_ids.length > 0 && !company_ids.includes(company.id)) {
            continue;
          }
          
          // Buscar admin da empresa
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('company_id', company.id)
            .eq('role', 'admin')
            .single();
          
          // Verificar se já recebeu email deste tipo
          const { data: existingLog } = await supabase
            .from('reengagement_email_logs')
            .select('id')
            .eq('company_id', company.id)
            .eq('template_type', template_type)
            .eq('status', 'sent')
            .single();
          
          inactiveCompanies.push({
            id: company.id,
            name: company.name,
            email: company.email,
            admin_name: profile?.full_name || null,
            admin_email: profile?.email || null,
            created_at: company.created_at,
            days_since_signup: daysSinceSignup,
            already_sent: !!existingLog
          });
        }
      }
    }

    console.log(`📊 Found ${inactiveCompanies.length} inactive companies`);

    // Se dry_run, retornar apenas a lista
    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          total_inactive: inactiveCompanies.length,
          inactive_companies: inactiveCompanies.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            admin_name: c.admin_name,
            admin_email: c.admin_email,
            created_at: c.created_at,
            days_inactive: c.days_since_signup,
            already_sent: c.already_sent,
            clients_count: 0,
            vehicles_count: 0,
            contracts_count: 0
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enviar emails
    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[]
    };

    const appUrl = Deno.env.get("APP_URL") || "https://gestaotracker.lovable.app";

    for (const company of inactiveCompanies) {
      const recipientEmail = company.admin_email || company.email;
      const recipientName = company.admin_name || company.name;
      
      // Pular se não tem email
      if (!recipientEmail) {
        results.skipped++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          status: 'skipped',
          reason: 'no_email'
        });
        continue;
      }
      
      // Pular se já recebeu
      if (company.already_sent) {
        results.skipped++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          status: 'skipped',
          reason: 'already_sent'
        });
        continue;
      }

      try {
        // Gerar HTML do email
        const emailHtml = generateReengagementEmail(recipientName, company.name, appUrl);
        
        // Enviar via Resend
        const { error: emailError } = await resend.emails.send({
          from: "GestaoTracker <suporte@liratracker.com.br>",
          to: [recipientEmail],
          subject: `🚀 ${recipientName}, seu GestaoTracker está te esperando!`,
          html: emailHtml,
        });

        if (emailError) {
          throw emailError;
        }

        // Logar envio
        await supabase.from('reengagement_email_logs').insert({
          company_id: company.id,
          email: recipientEmail,
          admin_name: recipientName,
          template_type,
          status: 'sent'
        });

        results.sent++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          email: recipientEmail,
          status: 'sent'
        });

        console.log(`✅ Email sent to ${recipientEmail} (${company.name})`);

      } catch (error: any) {
        console.error(`❌ Failed to send to ${recipientEmail}:`, error);
        
        // Logar erro
        await supabase.from('reengagement_email_logs').insert({
          company_id: company.id,
          email: recipientEmail,
          admin_name: recipientName,
          template_type,
          status: 'failed',
          error_message: error.message
        });

        results.failed++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          email: recipientEmail,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`📧 Reengagement complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-reengagement-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateReengagementEmail(userName: string, companyName: string, appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
          🚀 GestaoTracker
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          Sistema Completo de Gestão de Rastreamento
        </p>
      </div>
      
      <!-- Main Content -->
      <div style="background: white; padding: 40px 30px;">
        
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">
          Olá, ${userName}! 👋
        </h2>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">
          Notamos que você criou sua conta no <strong>GestaoTracker</strong> mas ainda não começou a usar o sistema. 
          Queremos ajudá-lo a dar os primeiros passos!
        </p>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 25px;">
          O GestaoTracker foi desenvolvido para facilitar a gestão completa da sua empresa de rastreamento. 
          Veja o que você pode fazer:
        </p>
        
        <!-- Features Grid -->
        <div style="margin-bottom: 30px;">
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="margin-right: 15px; font-size: 24px;">👥</div>
            <div>
              <strong style="color: #1f2937;">Gestão de Clientes</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                Cadastre e gerencie todos os seus clientes em um só lugar
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
            <div style="margin-right: 15px; font-size: 24px;">🚗</div>
            <div>
              <strong style="color: #1f2937;">Controle de Veículos</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                Registre veículos com rastreadores instalados e acompanhe o status
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #fefce8; border-radius: 8px; border-left: 4px solid #eab308;">
            <div style="margin-right: 15px; font-size: 24px;">📄</div>
            <div>
              <strong style="color: #1f2937;">Contratos Digitais</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                Crie contratos profissionais e gerencie assinaturas digitais
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #fdf2f8; border-radius: 8px; border-left: 4px solid #ec4899;">
            <div style="margin-right: 15px; font-size: 24px;">💰</div>
            <div>
              <strong style="color: #1f2937;">Cobranças Automáticas</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                Gere boletos e PIX automaticamente com integração bancária
              </p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; padding: 15px; background: #f5f3ff; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="margin-right: 15px; font-size: 24px;">📱</div>
            <div>
              <strong style="color: #1f2937;">WhatsApp Integrado</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
                Envie lembretes e cobranças automáticas via WhatsApp
              </p>
            </div>
          </div>
          
        </div>
        
        <!-- Steps -->
        <div style="background: #f9fafb; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">
            ⚡ Comece em 3 passos simples:
          </h3>
          <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li style="margin-bottom: 10px;"><strong>Cadastre seu primeiro cliente</strong> - Leva menos de 1 minuto</li>
            <li style="margin-bottom: 10px;"><strong>Adicione um veículo</strong> - Vincule ao cliente</li>
            <li><strong>Crie um contrato</strong> - O sistema gera cobranças automaticamente!</li>
          </ol>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="https://wa.me/5521992081803?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20para%20configurar%20minha%20conta%20GestaoTracker." 
             style="display: inline-block; background: linear-gradient(135deg, #25d366 0%, #128c7e 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.4);">
            💬 Me ajude a configurar Grátis
          </a>
        </div>
        
        <!-- Support -->
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            💬 Precisa de ajuda? Responda este email ou entre em contato conosco!
          </p>
        </div>
        
      </div>
      
      <!-- Footer -->
      <div style="padding: 25px 30px; text-align: center; background: #f9fafb;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
          Este email foi enviado para ${userName} (${companyName})
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          © ${new Date().getFullYear()} GestaoTracker - Sistema de Gestão de Rastreamento
        </p>
      </div>
      
    </body>
    </html>
  `;
}
