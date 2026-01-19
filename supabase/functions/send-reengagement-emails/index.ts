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
  template_type?: 'first_reminder' | 'second_reminder' | 'last_chance'; // Tipo de template
  force_send?: boolean; // Se true, ignora verificação de already_sent
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

// Helper function to add delay between emails (avoid rate limit)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      force_send = false,
      dry_run = false 
    }: ReengagementRequest = await req.json();

    console.log(`📧 Reengagement email request - dry_run: ${dry_run}, min_days: ${min_days_inactive}, template: ${template_type}, force: ${force_send}`);

    console.log('🔍 Iniciando busca otimizada com batch queries...');

    // ETAPA 1: Buscar todas as empresas ativas com contagens (1 query)
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

    // ETAPA 2: Filtrar empresas potencialmente inativas (sem queries)
    const potentiallyInactive = (companies || []).filter(company => {
      const clientCount = company.clients?.[0]?.count || 0;
      const vehicleCount = company.vehicles?.[0]?.count || 0;
      const contractCount = company.contracts?.[0]?.count || 0;
      
      if (clientCount > 0 || vehicleCount > 0 || contractCount > 0) {
        return false;
      }
      
      const daysSinceSignup = Math.floor(
        (Date.now() - new Date(company.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceSignup < min_days_inactive) {
        return false;
      }
      
      if (company_ids && company_ids.length > 0 && !company_ids.includes(company.id)) {
        return false;
      }
      
      return true;
    });

    console.log(`📊 ${potentiallyInactive.length} empresas potencialmente inativas encontradas`);

    // Se não há empresas, retornar cedo
    if (potentiallyInactive.length === 0) {
      const emptyResult = dry_run 
        ? { success: true, dry_run: true, total_inactive: 0, inactive_companies: [] }
        : { success: true, results: { sent: 0, skipped: 0, failed: 0, details: [] } };
      
      return new Response(
        JSON.stringify(emptyResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyIds = potentiallyInactive.map(c => c.id);

    // ETAPA 3: BATCH - Buscar todos os admins de uma vez (1 query em vez de N)
    console.log('📥 Buscando perfis de admin em batch...');
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('company_id, full_name, email')
      .in('company_id', companyIds)
      .eq('role', 'admin');

    // Criar mapa para acesso O(1)
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    for (const profile of allProfiles || []) {
      if (!profileMap.has(profile.company_id)) {
        profileMap.set(profile.company_id, { 
          full_name: profile.full_name, 
          email: profile.email 
        });
      }
    }
    console.log(`✅ ${profileMap.size} perfis de admin encontrados`);

    // ETAPA 4: BATCH - Verificar emails já enviados de uma vez (1 query em vez de N)
    console.log('📥 Verificando logs de emails em batch...');
    const { data: existingLogs } = await supabase
      .from('reengagement_email_logs')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('template_type', template_type)
      .eq('status', 'sent');

    // Criar Set para verificação O(1)
    const sentCompanyIds = new Set((existingLogs || []).map(l => l.company_id));
    console.log(`✅ ${sentCompanyIds.size} empresas já receberam email`);

    // ETAPA 5: Montar lista final sem queries adicionais
    const inactiveCompanies: InactiveCompany[] = potentiallyInactive.map(company => {
      const profile = profileMap.get(company.id);
      const daysSinceSignup = Math.floor(
        (Date.now() - new Date(company.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: company.id,
        name: company.name,
        email: company.email,
        admin_name: profile?.full_name || null,
        admin_email: profile?.email || null,
        created_at: company.created_at,
        days_since_signup: daysSinceSignup,
        already_sent: sentCompanyIds.has(company.id)
      };
    });

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
      
      // Pular se já recebeu (exceto se force_send = true)
      if (company.already_sent && !force_send) {
        results.skipped++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          status: 'skipped',
          reason: 'already_sent'
        });
        continue;
      }

      // Aguardar 1 segundo ANTES de cada envio para evitar rate limit
      await sleep(1000);

      // Gerar HTML do email baseado no template
      const emailHtml = generateReengagementEmail(recipientName, company.name, appUrl, template_type);
      const emailSubject = getEmailSubject(recipientName, template_type);
      
      // Retry com backoff exponencial para rate limit
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      let emailSent = false;

      while (attempts < maxAttempts && !emailSent) {
        try {
          console.log(`📤 Tentativa ${attempts + 1}/${maxAttempts} para ${recipientEmail}...`);
          
          const { error: emailError } = await resend.emails.send({
            from: "GestaoTracker <suporte@liratracker.com.br>",
            to: [recipientEmail],
            subject: emailSubject,
            html: emailHtml,
          });

          if (emailError) {
            throw emailError;
          }

          emailSent = true;

          // Logar envio bem-sucedido
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

          console.log(`✅ Email enviado para ${recipientEmail} (${company.name})`);

        } catch (error: any) {
          lastError = error;
          attempts++;
          
          // Verificar se é rate limit (429)
          const isRateLimit = error?.statusCode === 429 || 
                              error?.message?.includes('rate_limit') ||
                              error?.name === 'rate_limit_exceeded';
          
          if (isRateLimit && attempts < maxAttempts) {
            // Backoff exponencial: 2s, 4s, 6s
            const waitTime = attempts * 2000;
            console.log(`⏳ Rate limit detectado! Aguardando ${waitTime}ms antes de retry ${attempts}/${maxAttempts}...`);
            await sleep(waitTime);
          } else if (!isRateLimit) {
            // Erro não é rate limit, não fazer retry
            console.error(`❌ Erro não-recuperável para ${recipientEmail}:`, error);
            break;
          }
        }
      }

      // Se todas as tentativas falharam, logar erro
      if (!emailSent) {
        console.error(`❌ Falha após ${attempts} tentativas para ${recipientEmail}:`, lastError);
        
        await supabase.from('reengagement_email_logs').insert({
          company_id: company.id,
          email: recipientEmail,
          admin_name: recipientName,
          template_type,
          status: 'failed',
          error_message: lastError?.message || 'Unknown error after max retries'
        });

        results.failed++;
        results.details.push({
          company_id: company.id,
          company_name: company.name,
          email: recipientEmail,
          status: 'failed',
          error: lastError?.message || 'Unknown error after max retries'
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

function getEmailSubject(userName: string, templateType: string): string {
  switch (templateType) {
    case 'second_reminder':
      return `⏰ ${userName}, ainda estamos aqui para ajudar!`;
    case 'last_chance':
      return `⚠️ ${userName}, última chance de ativar sua conta!`;
    default:
      return `🚀 ${userName}, seu GestaoTracker está te esperando!`;
  }
}

function generateReengagementEmail(userName: string, companyName: string, appUrl: string, templateType: string = 'first_reminder'): string {
  const header = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">`;

  const footer = `
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
    </html>`;

  if (templateType === 'second_reminder') {
    return `${header}
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
          ⏰ Lembrete Especial
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          Seu GestaoTracker ainda está esperando por você
        </p>
      </div>
      
      <div style="background: white; padding: 40px 30px;">
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">
          Olá novamente, ${userName}! 👋
        </h2>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">
          Entramos em contato há alguns dias e notamos que você ainda não conseguiu configurar sua conta.
          <strong>Estamos aqui para ajudar!</strong>
        </p>
        
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e; font-size: 15px;">
            💡 <strong>Dica:</strong> Muitos clientes conseguem cadastrar seus primeiros dados em menos de 5 minutos com nossa ajuda gratuita!
          </p>
        </div>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 25px;">
          Entendemos que a rotina é corrida. Por isso, oferecemos <strong>suporte gratuito via WhatsApp</strong> para configurar tudo para você:
        </p>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="https://wa.me/5521992081803?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20para%20configurar%20minha%20conta%20GestaoTracker.%20%C3%89%20meu%20segundo%20contato." 
             style="display: inline-block; background: linear-gradient(135deg, #25d366 0%, #128c7e 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.4);">
            💬 Falar com Suporte Agora
          </a>
        </div>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            📞 Nosso time está disponível de segunda a sexta, das 9h às 18h
          </p>
        </div>
      </div>
      ${footer}`;
  }

  if (templateType === 'last_chance') {
    return `${header}
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
          ⚠️ Última Chance
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          Sua conta pode ser desativada por inatividade
        </p>
      </div>
      
      <div style="background: white; padding: 40px 30px;">
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">
          ${userName}, precisamos conversar... 😔
        </h2>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">
          Esta é nossa última tentativa de contato. Notamos que sua conta no GestaoTracker permanece inativa desde a criação.
        </p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ef4444;">
          <p style="margin: 0; color: #991b1b; font-size: 15px;">
            ⚠️ <strong>Importante:</strong> Contas inativas por muito tempo podem ser desativadas para liberação de recursos do sistema.
          </p>
        </div>
        
        <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">
          Se você está enfrentando dificuldades ou tem dúvidas, <strong>queremos muito te ajudar</strong>. Basta clicar no botão abaixo:
        </p>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <a href="https://wa.me/5521992081803?text=Ol%C3%A1!%20Recebi%20o%20aviso%20de%20%C3%BAltima%20chance%20e%20preciso%20de%20ajuda%20urgente%20para%20configurar%20minha%20conta." 
             style="display: inline-block; background: linear-gradient(135deg, #25d366 0%, #128c7e 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.4);">
            💬 Preciso de Ajuda Urgente
          </a>
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${appUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
            🚀 Acessar Minha Conta Agora
          </a>
        </div>
        
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #166534; font-size: 14px;">
            ✅ Se você não deseja mais receber nossos emails, basta responder "CANCELAR"
          </p>
        </div>
      </div>
      ${footer}`;
  }

  // Default: first_reminder
  return `${header}
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
          🚀 GestaoTracker
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
          Sistema Completo de Gestão de Rastreamento
        </p>
      </div>
      
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
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Cadastre e gerencie todos os seus clientes em um só lugar</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
            <div style="margin-right: 15px; font-size: 24px;">🚗</div>
            <div>
              <strong style="color: #1f2937;">Controle de Veículos</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Registre veículos com rastreadores instalados e acompanhe o status</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #fefce8; border-radius: 8px; border-left: 4px solid #eab308;">
            <div style="margin-right: 15px; font-size: 24px;">📄</div>
            <div>
              <strong style="color: #1f2937;">Contratos Digitais</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Crie contratos profissionais e gerencie assinaturas digitais</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #fdf2f8; border-radius: 8px; border-left: 4px solid #ec4899;">
            <div style="margin-right: 15px; font-size: 24px;">💰</div>
            <div>
              <strong style="color: #1f2937;">Cobranças Automáticas</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Gere boletos e PIX automaticamente com integração bancária</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: flex-start; padding: 15px; background: #f5f3ff; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="margin-right: 15px; font-size: 24px;">📱</div>
            <div>
              <strong style="color: #1f2937;">WhatsApp Integrado</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Envie lembretes e cobranças automáticas via WhatsApp</p>
            </div>
          </div>
        </div>
        
        <!-- Steps -->
        <div style="background: #f9fafb; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">⚡ Comece em 3 passos simples:</h3>
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
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            💬 Precisa de ajuda? Responda este email ou entre em contato conosco!
          </p>
        </div>
      </div>
      ${footer}`;
}
