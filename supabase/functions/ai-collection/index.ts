import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, company_id, payment_id, custom_tone } = await req.json();
    
    console.log('AI Collection action:', { action, company_id, payment_id, custom_tone: custom_tone || 'padrão' });

    // Processar pagamento específico (para comando do gestor ou sistema de notificações)
    if (action === 'process_specific_payment') {
      const { data: payment } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients:client_id(*)
        `)
        .eq('id', payment_id)
        .single();

      if (!payment) {
        throw new Error('Pagamento não encontrado');
      }

      const client = payment.clients;
      
      if (!client || !client.phone) {
        throw new Error('Cliente sem telefone cadastrado');
      }

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', payment.company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Buscar templates escalonados da empresa
      const { data: notificationSettings } = await supabase
        .from('payment_notification_settings')
        .select(`
          template_post_due,
          template_post_due_warning,
          template_post_due_urgent,
          template_post_due_final,
          template_suspended
        `)
        .eq('company_id', payment.company_id)
        .single();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
      };

      console.log('Usando configurações de IA:', aiSettings ? 'personalizadas' : 'padrão');

      // Calcular dias até/desde o vencimento
      const now = new Date();
      const dueDate = new Date(payment.due_date);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const isOverdue = diffDays > 0;
      const daysOverdue = isOverdue ? diffDays : 0;
      const daysUntilDue = isOverdue ? 0 : Math.abs(diffDays);

      // Buscar informações da empresa (incluindo domínio)
      const { data: companyInfo } = await supabase
        .from('companies')
        .select('name, domain')
        .eq('id', payment.company_id)
        .single();

      const companyName = companyInfo?.name || 'Lira Tracker';

      // Build payment link using company domain (remove protocol and trailing slashes)
      // Sanitiza APP_URL: remove trailing slashes para evitar barra dupla no checkout
      const defaultAppUrl = (Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app').replace(/\/+$/, '');
      // Sanitiza domínio: remove protocolo (http/https) e trailing slashes para evitar URLs duplicadas
      const sanitizedDomain = companyInfo?.domain 
        ? companyInfo.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
        : null;
      const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : defaultAppUrl;
      const paymentLink = `${baseUrl}/checkout/${payment.id}`;
      console.log(`📎 Payment link for AI: ${paymentLink}`);

      // Determinar histórico de pagamento
      const { data: pastPayments } = await supabase
        .from('payment_transactions')
        .select('status, due_date, paid_at')
        .eq('client_id', client.id)
        .eq('company_id', payment.company_id)
        .neq('id', payment.id)
        .order('due_date', { ascending: false })
        .limit(5);

      let paymentHistory = 'Primeiro Pagamento';
      if (pastPayments && pastPayments.length > 0) {
        const latePayments = pastPayments.filter(p => {
          if (p.paid_at && p.due_date) {
            return new Date(p.paid_at) > new Date(p.due_date);
          }
          return false;
        });
        paymentHistory = latePayments.length > 1 ? 'Atrasos Recorrentes' : 'Histórico Regular';
      }

      // Função para formatar data no padrão BR
      const formatDateBR = (date: Date): string => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      // Determinar nível de escalada e template baseado nos dias de atraso
      let escalatedTemplate: string | null = null;
      let escalationLevel = 'normal';

      if (isOverdue && notificationSettings) {
        if (daysOverdue >= 21) {
          escalatedTemplate = notificationSettings.template_suspended;
          escalationLevel = 'suspension';
        } else if (daysOverdue >= 16) {
          escalatedTemplate = notificationSettings.template_post_due_final;
          escalationLevel = 'final';
        } else if (daysOverdue >= 11) {
          escalatedTemplate = notificationSettings.template_post_due_urgent;
          escalationLevel = 'urgent';
        } else if (daysOverdue >= 6) {
          escalatedTemplate = notificationSettings.template_post_due_warning;
          escalationLevel = 'warning';
        }
      }

      console.log(`📊 Escalation level: ${escalationLevel}, days overdue: ${daysOverdue}`);

      // Se temos um template escalonado, processá-lo para usar como base
      let templateInstruction = '';
      if (escalatedTemplate) {
        const processedTemplate = escalatedTemplate
          .replace(/\{\{cliente\}\}/gi, client.name)
          .replace(/\{\{valor\}\}/gi, `R$${payment.amount.toFixed(2)}`)
          .replace(/\{\{dias\}\}/gi, String(daysOverdue))
          .replace(/\{\{vencimento\}\}/gi, formatDateBR(dueDate))
          .replace(/\{\{empresa\}\}/gi, companyName);
        
        templateInstruction = `
**🎯 TEMPLATE BASE OBRIGATÓRIO:**
Use este template como BASE da mensagem, mantendo o TOM e URGÊNCIA, mas adicione variações naturais para evitar spam:

"${processedTemplate}"

Você pode variar a saudação e reorganizar levemente, mas MANTENHA a seriedade e urgência do template original.
`;
        console.log(`📝 Usando template escalonado: ${escalationLevel}`);
      }

      // Determinar tom e contexto baseado no status e nível de escalada
      let toneInstruction = '';
      let contextDescription = '';
      
      if (!isOverdue) {
        // Notificação PRÉ-VENCIMENTO
        const dueDateText = daysUntilDue === 0 
          ? 'HOJE' 
          : daysUntilDue === 1 
            ? 'amanhã' 
            : `em ${daysUntilDue} dias`;
        
        if (daysUntilDue === 0) {
          contextDescription = `IMPORTANTE: Este pagamento VENCE HOJE. Use urgência apropriada.`;
          toneInstruction = 'Use um TOM DIRETO E OBJETIVO. O vencimento é HOJE - enfatize "vence hoje", não use "0 dias". Enfatize a importância de pagar no dia para evitar pendências.';
        } else {
          contextDescription = `IMPORTANTE: Este é um LEMBRETE de cobrança que ainda NÃO está vencida. O vencimento é ${dueDateText}.`;
          toneInstruction = 'Use um TOM AMIGÁVEL E PREVENTIVO. Foque em lembrar sobre o vencimento próximo para evitar esquecimento. Não mencione atraso ou consequências.';
        }
      } else if (escalationLevel === 'suspension') {
        contextDescription = `CRÍTICO: Cliente com ${daysOverdue} dias de atraso - SERVIÇO SUSPENSO ou prestes a suspender.`;
        toneInstruction = 'Use um TOM MUITO FIRME E DIRETO. Mencione suspensão do serviço. Não seja agressivo, mas seja claro sobre as consequências. A situação é GRAVE.';
      } else if (escalationLevel === 'final') {
        contextDescription = `ALERTA FINAL: Cliente com ${daysOverdue} dias de atraso - último aviso antes da suspensão.`;
        toneInstruction = 'Use um TOM URGENTE E SÉRIO. Este é o ÚLTIMO AVISO. Enfatize que a suspensão é iminente (24-48h). Seja assertivo.';
      } else if (escalationLevel === 'urgent') {
        contextDescription = `URGENTE: Cliente com ${daysOverdue} dias de atraso - situação crítica.`;
        toneInstruction = 'Use um TOM PROFISSIONAL E ASSERTIVO. Deixe claro a gravidade da situação e possíveis consequências próximas.';
      } else if (escalationLevel === 'warning') {
        contextDescription = `AVISO: Cliente com ${daysOverdue} dias de atraso.`;
        toneInstruction = 'Use um TOM OBJETIVO E DIRETO. Mencione que o atraso está se prolongando e precisa de atenção imediata.';
      } else if (daysOverdue <= 5) {
        contextDescription = `A cobrança está VENCIDA há ${daysOverdue} dia(s).`;
        toneInstruction = 'Use um TOM CORDIAL E EMPÁTICO. Sugira que pode ter sido um esquecimento. O foco é apenas o lembrete.';
      } else {
        contextDescription = `A cobrança está VENCIDA há ${daysOverdue} dias.`;
        toneInstruction = 'Use um TOM PROFISSIONAL E OBJETIVO. Mencione a importância do serviço.';
      }

      // Se o gestor especificou um tom customizado, sobrescrever o tom padrão
      if (custom_tone) {
        console.log('🎯 Tom customizado solicitado pelo gestor:', custom_tone);
        
        const toneMap: Record<string, string> = {
          'agressivo': 'Use um TOM AGRESSIVO E FIRME. Seja direto e incisivo. Deixe claro que há consequências imediatas para o não pagamento. Use frases como "urgente", "imediatamente", "último aviso". Deixe claro que a inadimplência é inaceitável.',
          'muito_agressivo': 'Use um TOM MUITO AGRESSIVO E INTIMIDADOR. Mencione ação judicial iminente, suspensão imediata do serviço, negativação no SPC/Serasa. Seja extremamente firme e direto. Use linguagem de ÚLTIMO AVISO.',
          'amigavel': 'Use um TOM AMIGÁVEL E COMPREENSIVO. Seja gentil, empático e ofereça ajuda para resolver a situação. Demonstre que entende possíveis dificuldades.',
          'formal': 'Use um TOM EXTREMAMENTE FORMAL E PROFISSIONAL. Linguagem corporativa, distante e técnica. Sem informalidades.',
          'urgente': 'Use um TOM DE URGÊNCIA MÁXIMA. Enfatize que o prazo está acabando, que a ação é necessária AGORA e que há consequências para demora.',
          'firme': 'Use um TOM FIRME E ASSERTIVO. Seja direto, sem rodeios, deixando claro a seriedade da situação.'
        };
        
        // Normalizar o tom recebido (aceitar variações)
        const normalizedTone = custom_tone.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/muito\s*agressivo/g, 'muito_agressivo')
          .replace(/\s+/g, '_')
          .trim();
        
        toneInstruction = toneMap[normalizedTone] || 
          `Use um TOM ${custom_tone.toUpperCase()}. Adapte completamente a mensagem seguindo esse estilo de comunicação.`;
        
        console.log('📝 Instrução de tom aplicada:', toneInstruction);
      }

      // Instruções ANTI-SPAM para variação natural das mensagens
      const antiSpamInstructions = `
**🛡️ REGRAS ANTI-SPAM (CRÍTICO - EVITAR BANIMENTO DO WHATSAPP):**
1. **Varie a saudação ALEATORIAMENTE:** Escolha UMA destas opções de forma aleatória: "Olá", "Oi", "Bom dia", "Boa tarde", "Prezado(a)", "Caro(a)", "Ei". NUNCA use a mesma saudação duas vezes seguidas.
2. **Estruture de forma DIFERENTE:** Alterne a ordem das informações - às vezes valor primeiro depois vencimento, às vezes vencimento primeiro depois valor.
3. **Varie expressões:** Use sinônimos diferentes a cada mensagem: "favor realizar", "solicitamos gentilmente", "pedimos a gentileza", "lembramos sobre", "passando para lembrar", "um lembrete rápido sobre", etc.
4. **Humanize com naturalidade:** Adicione pequenas variações naturais como "espero que esteja bem", "passando rapidamente", "um lembrete amigável", "aproveitando para lembrar".
5. **NUNCA repita** exatamente o mesmo texto ou estrutura de mensagens anteriores - cada mensagem deve ser ÚNICA.
6. **Evite padrões detectáveis:** Não use sempre a mesma estrutura de parágrafos. Varie entre 2-4 parágrafos.
`;

      // Preparar prompt estruturado para a IA (SEM incluir link - será enviado separadamente)
      const prompt = `**INSTRUÇÃO:** Crie uma mensagem de notificação de cobrança para WhatsApp. O texto deve ser focado, direto ao ponto e otimizado para a leitura no canal escolhido.

**IMPORTANTE:** NÃO inclua nenhum link na mensagem. O link de pagamento será enviado em uma mensagem separada logo após esta.
${templateInstruction}
${antiSpamInstructions}

**CONTEXTO CRÍTICO DA COBRANÇA:**
${contextDescription}

**DADOS DO CLIENTE E CONTEXTO:**
1. Nome do Cliente: ${client.name}
2. Valor: R$${payment.amount.toFixed(2)}
3. ${isOverdue ? `Dias de Atraso: ${daysOverdue} dias` : daysUntilDue === 0 ? 'Vencimento: HOJE' : daysUntilDue === 1 ? 'Vencimento: Amanhã' : `Dias até o Vencimento: ${daysUntilDue} dias`}
4. Histórico de Pagamento: ${paymentHistory}

**DEFINIÇÃO DO TOM DE VOZ:**
${toneInstruction}

**RESTRIÇÕES E REGRAS:**
* A mensagem deve ser iniciada com a saudação personalizada e a menção direta ao SaaS (${companyName}).
* **Proibido** usar a palavra "dívida" em qualquer situação.
${!isOverdue 
  ? `* **REGRA CRÍTICA PARA PRÉ-VENCIMENTO:** Esta fatura AINDA NÃO VENCEU! **PROIBIDO ABSOLUTAMENTE** usar: "pendência", "pendente", "atraso", "atrasado", "em aberto", "débito". Use APENAS: "fatura", "cobrança", "mensalidade", "pagamento" (sem "pendente"). O tom deve ser de LEMBRETE AMIGÁVEL, não de cobrança.`
  : `* Para cobranças VENCIDAS: Use termos como "pendência", "pagamento em atraso", "fatura vencida" ou "saldo em aberto".`}
* Inclua o valor (R$${payment.amount.toFixed(2)}) no corpo da mensagem de forma clara.
* ${isOverdue 
    ? `Mencione claramente que está VENCIDA há ${daysOverdue} dia(s).` 
    : daysUntilDue === 0 
      ? `Mencione claramente que VENCE HOJE (não use "0 dias", use "hoje").`
      : daysUntilDue === 1
        ? `Mencione que VENCE AMANHÃ e que é um lembrete preventivo.`
        : `Mencione que VENCE em ${daysUntilDue} dias e que é um lembrete preventivo.`}
* **NÃO INCLUA NENHUM LINK** - ele será enviado automaticamente em seguida.
* Finalize indicando que o link de pagamento será enviado logo após.
* Termine a mensagem com "Atenciosamente, ${companyName}".

**GERE APENAS O TEXTO DA MENSAGEM SEM LINKS.**`;

      // Chamar OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openai_model || 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: settings.system_prompt || 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600,
          temperature: 0.7
        }),
      });

      const aiData = await response.json();
      
      if (!response.ok) {
        throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
      }

      const generatedMessage = aiData.choices[0].message.content;
      const usage = aiData.usage;

      console.log('✅ Mensagem gerada com sucesso pela IA');

      // Salvar log da IA após gerar (se configurações existirem)
      if (aiSettings) {
        await supabase.from('ai_collection_logs').insert({
          company_id: payment.company_id,
          payment_id: payment.id,
          client_id: client.id,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          model_used: settings.openai_model || 'gpt-4o-mini',
          generated_message: generatedMessage,
          sent_successfully: null // Não envia aqui, apenas gera
        });
      } else {
        console.log('Logs de IA não salvos - configurações não encontradas na tabela');
      }

      // Retornar apenas a mensagem gerada - o billing-notifications enviará
      return new Response(
        JSON.stringify({ 
          success: true,
          generated_message: generatedMessage,
          client_phone: client.phone,
          client_name: client.name,
          usage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'process_overdue_clients') {
      // Buscar clientes inadimplentes
      const { data: overduePayments } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          clients:client_id(*)
        `)
        .eq('company_id', company_id)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(10);

      if (!overduePayments || overduePayments.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'Nenhum cliente inadimplente encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Buscar templates escalonados da empresa
      const { data: notificationSettings } = await supabase
        .from('payment_notification_settings')
        .select(`
          template_post_due,
          template_post_due_warning,
          template_post_due_urgent,
          template_post_due_final,
          template_suspended
        `)
        .eq('company_id', company_id)
        .single();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
      };

      console.log('Process overdue - Usando configurações:', aiSettings ? 'personalizadas' : 'padrão');

      // Função para formatar data no padrão BR
      const formatDateBR = (date: Date): string => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const results = [];

      // Processar cada pagamento
      for (const payment of overduePayments) {
        const client = payment.clients;
        
        if (!client || !client.phone) {
          console.log(`Cliente sem telefone: ${payment.id}`);
          continue;
        }

        // Calcular dias de atraso
        const dueDate = new Date(payment.due_date);
        const daysOverdue = Math.floor(
          (new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Buscar informações da empresa (incluindo domínio)
        const { data: companyInfo } = await supabase
          .from('companies')
          .select('name, domain')
          .eq('id', company_id)
          .single();

        const companyName = companyInfo?.name || 'Lira Tracker';

        // Build payment link using company domain (remove protocol and trailing slashes)
        const defaultAppUrl = Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app';
        const baseUrl = companyInfo?.domain 
          ? `https://${companyInfo.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')}` 
          : defaultAppUrl;
        const paymentLink = `${baseUrl}/checkout/${payment.id}`;

        // Determinar histórico de pagamento
        const { data: pastPayments } = await supabase
          .from('payment_transactions')
          .select('status, due_date, paid_at')
          .eq('client_id', client.id)
          .eq('company_id', company_id)
          .neq('id', payment.id)
          .order('due_date', { ascending: false })
          .limit(5);

        let paymentHistory = 'Primeiro Atraso';
        if (pastPayments && pastPayments.length > 0) {
          const latePayments = pastPayments.filter(p => {
            if (p.paid_at && p.due_date) {
              return new Date(p.paid_at) > new Date(p.due_date);
            }
            return false;
          });
          paymentHistory = latePayments.length > 1 ? 'Atrasos Recorrentes' : 'Histórico Regular';
        }

        // Determinar nível de escalada e template baseado nos dias de atraso
        let escalatedTemplate: string | null = null;
        let escalationLevel = 'normal';

        if (notificationSettings) {
          if (daysOverdue >= 21) {
            escalatedTemplate = notificationSettings.template_suspended;
            escalationLevel = 'suspension';
          } else if (daysOverdue >= 16) {
            escalatedTemplate = notificationSettings.template_post_due_final;
            escalationLevel = 'final';
          } else if (daysOverdue >= 11) {
            escalatedTemplate = notificationSettings.template_post_due_urgent;
            escalationLevel = 'urgent';
          } else if (daysOverdue >= 6) {
            escalatedTemplate = notificationSettings.template_post_due_warning;
            escalationLevel = 'warning';
          }
        }

        console.log(`📊 Processing ${client.name} - Escalation: ${escalationLevel}, days: ${daysOverdue}`);

        // Se temos um template escalonado, processá-lo para usar como base
        let templateInstruction = '';
        if (escalatedTemplate) {
          const processedTemplate = escalatedTemplate
            .replace(/\{\{cliente\}\}/gi, client.name)
            .replace(/\{\{valor\}\}/gi, `R$${payment.amount.toFixed(2)}`)
            .replace(/\{\{dias\}\}/gi, String(daysOverdue))
            .replace(/\{\{vencimento\}\}/gi, formatDateBR(dueDate))
            .replace(/\{\{empresa\}\}/gi, companyName);
          
          templateInstruction = `
**🎯 TEMPLATE BASE OBRIGATÓRIO:**
Use este template como BASE da mensagem, mantendo o TOM e URGÊNCIA, mas adicione variações naturais para evitar spam:

"${processedTemplate}"

Você pode variar a saudação e reorganizar levemente, mas MANTENHA a seriedade e urgência do template original.
`;
        }

        // Determinar tom baseado em nível de escalada
        let toneInstruction = '';
        let contextDescription = '';

        if (escalationLevel === 'suspension') {
          contextDescription = `CRÍTICO: Cliente com ${daysOverdue} dias de atraso - SERVIÇO SUSPENSO ou prestes a suspender.`;
          toneInstruction = 'Use um TOM MUITO FIRME E DIRETO. Mencione suspensão do serviço. Não seja agressivo, mas seja claro sobre as consequências.';
        } else if (escalationLevel === 'final') {
          contextDescription = `ALERTA FINAL: Cliente com ${daysOverdue} dias de atraso - último aviso antes da suspensão.`;
          toneInstruction = 'Use um TOM URGENTE E SÉRIO. Este é o ÚLTIMO AVISO. Enfatize que a suspensão é iminente.';
        } else if (escalationLevel === 'urgent') {
          contextDescription = `URGENTE: Cliente com ${daysOverdue} dias de atraso - situação crítica.`;
          toneInstruction = 'Use um TOM PROFISSIONAL E ASSERTIVO. Deixe claro a gravidade da situação.';
        } else if (escalationLevel === 'warning') {
          contextDescription = `AVISO: Cliente com ${daysOverdue} dias de atraso.`;
          toneInstruction = 'Use um TOM OBJETIVO E DIRETO. Mencione que o atraso está se prolongando.';
        } else if (daysOverdue <= 5) {
          contextDescription = `A cobrança está VENCIDA há ${daysOverdue} dia(s).`;
          toneInstruction = 'Use um TOM CORDIAL E EMPÁTICO. Sugira que pode ter sido um esquecimento.';
        } else {
          contextDescription = `A cobrança está VENCIDA há ${daysOverdue} dias.`;
          toneInstruction = 'Use um TOM PROFISSIONAL E OBJETIVO. Mencione a importância do serviço.';
        }

        try {
          // Instruções ANTI-SPAM para variação natural das mensagens
          const antiSpamInstructions = `
**🛡️ REGRAS ANTI-SPAM (CRÍTICO - EVITAR BANIMENTO DO WHATSAPP):**
1. **Varie a saudação ALEATORIAMENTE:** Escolha UMA destas opções de forma aleatória: "Olá", "Oi", "Bom dia", "Boa tarde", "Prezado(a)", "Caro(a)", "Ei". NUNCA use a mesma saudação duas vezes seguidas.
2. **Estruture de forma DIFERENTE:** Alterne a ordem das informações.
3. **Varie expressões:** Use sinônimos diferentes a cada mensagem.
4. **Humanize com naturalidade:** Adicione pequenas variações naturais.
5. **NUNCA repita** exatamente o mesmo texto ou estrutura.
`;

          // Preparar prompt estruturado para a IA (SEM link - será enviado separadamente)
          const prompt = `**INSTRUÇÃO:** Crie uma mensagem de notificação de cobrança para WhatsApp. O texto deve ser focado, direto ao ponto e otimizado para a leitura no canal escolhido.

**IMPORTANTE:** NÃO inclua nenhum link na mensagem. O link de pagamento será enviado em uma mensagem separada logo após esta.
${templateInstruction}
${antiSpamInstructions}

**CONTEXTO CRÍTICO DA COBRANÇA:**
${contextDescription}

**DADOS DO CLIENTE E CONTEXTO:**
1. Nome do Cliente: ${client.name}
2. Valor Pendente: R$${payment.amount.toFixed(2)}
3. Dias de Atraso: ${daysOverdue} dias
4. Histórico de Pagamento: ${paymentHistory}

**DEFINIÇÃO DO TOM DE VOZ:**
${toneInstruction}

**RESTRIÇÕES E REGRAS:**
* A mensagem deve ser iniciada com a saudação personalizada e a menção direta ao SaaS (${companyName}).
* **Proibido** usar a palavra "dívida". Use termos como "pendência", "pagamento pendente", "saldo em aberto" ou "fatura".
* Inclua o valor (R$${payment.amount.toFixed(2)}) e os dias de atraso (${daysOverdue} dias) no corpo da mensagem de forma clara.
* **NÃO INCLUA NENHUM LINK** - ele será enviado automaticamente em seguida.
* Finalize indicando que o link de pagamento será enviado logo após.
* Termine a mensagem com "Atenciosamente, ${companyName}".

**GERE APENAS O TEXTO DA MENSAGEM SEM LINKS.**`;

          // Chamar OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
          body: JSON.stringify({
            model: settings.openai_model || 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: settings.system_prompt || 'Você é um assistente de comunicação de cobrança para um SaaS. Sua prioridade é a recuperação financeira mantendo um relacionamento cordial com o cliente.'
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 600,
            temperature: 0.7
          }),
          });

          const aiData = await response.json();
          
          if (!response.ok) {
            throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
          }

          const generatedMessage = aiData.choices[0].message.content;
          const usage = aiData.usage;

          // Remove any links that might have been generated
          const messageWithoutLink = generatedMessage
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          // Build unified message with link
          const fullMessage = `${messageWithoutLink}\n\n🔗 Acesse aqui: ${paymentLink}`;

          // Enviar via WhatsApp (mensagem única sem preview de link)
          const { data: whatsappSettings } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', company_id)
            .eq('is_active', true)
            .single();

          let messageSent = false;
          if (whatsappSettings) {
            const sendResult = await supabase.functions.invoke('whatsapp-evolution', {
              body: {
                action: 'sendText',
                instance_url: whatsappSettings.instance_url,
                api_token: whatsappSettings.api_token,
                instance_name: whatsappSettings.instance_name,
                number: client.phone,
                message: fullMessage,
                company_id: company_id,
                client_id: client.id,
                linkPreview: false  // Disable link preview for cleaner message
              }
            });

            messageSent = sendResult.data?.success || false;
          }

          // Salvar log da IA após enviar (se configurações existirem)
          if (aiSettings) {
            await supabase.from('ai_collection_logs').insert({
              company_id,
              payment_id: payment.id,
              client_id: client.id,
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
              model_used: settings.openai_model || 'gpt-4o-mini',
              generated_message: `${messageWithoutLink}\n\n[Link enviado separadamente: ${paymentLink}]`,
              sent_successfully: messageSent
            });
          }

          results.push({
            payment_id: payment.id,
            client_name: client.name,
            success: messageSent,
            message: messageWithoutLink,
            link: paymentLink
          });

        } catch (error) {
          console.error(`Erro ao processar pagamento ${payment.id}:`, error);
          
          // Salvar erro no log (se configurações existirem)
          if (aiSettings) {
            await supabase.from('ai_collection_logs').insert({
              company_id,
              payment_id: payment.id,
              client_id: client.id,
              model_used: settings.openai_model || 'gpt-4o-mini',
              sent_successfully: false,
              error_message: error instanceof Error ? error.message : String(error)
            });
          }

          results.push({
            payment_id: payment.id,
            client_name: client.name,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: results.length,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate_weekly_report') {
      // Buscar configurações do relatório
      const { data: reportSettings } = await supabase
        .from('ai_weekly_reports')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (!reportSettings || !reportSettings.manager_phone) {
        throw new Error('Configurações de relatório não encontradas ou telefone do gestor não configurado');
      }

      // Buscar dados dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentPayments } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('company_id', company_id)
        .gte('created_at', sevenDaysAgo.toISOString());

      const totalReceived = recentPayments
        ?.filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalPending = recentPayments
        ?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalOverdue = recentPayments
        ?.filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Buscar configurações de IA (usar padrão se não existir)
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .maybeSingle();

      // Usar configurações padrão se não estiverem configuradas
      const settings = aiSettings || {
        openai_model: 'gpt-4o-mini',
        system_prompt: 'Você é um assistente financeiro que gera relatórios executivos concisos.'
      };

      console.log('Relatório semanal - Usando configurações:', aiSettings ? 'personalizadas' : 'padrão');

      // Gerar relatório com IA
      const prompt = `Gere um relatório executivo resumido da semana com os seguintes dados:
- Total recebido: R$ ${totalReceived.toFixed(2)}
- Total pendente: R$ ${totalPending.toFixed(2)}
- Total em atraso: R$ ${totalOverdue.toFixed(2)}
- Total de cobranças: ${recentPayments?.length || 0}

O relatório deve ser profissional e conciso para envio via WhatsApp ao gestor.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: settings.system_prompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 800,
          temperature: 0.5
        }),
      });

      const aiData = await response.json();
      
      if (!response.ok) {
        throw new Error(aiData.error?.message || 'Erro ao gerar relatório');
      }

      const reportMessage = aiData.choices[0].message.content;

      // Enviar relatório via WhatsApp
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .single();

      if (whatsappSettings && reportSettings.manager_phones && reportSettings.manager_phones.length > 0) {
        // Enviar para todos os gestores cadastrados
        const sendPromises = reportSettings.manager_phones.map(phone => 
          supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: phone,
              message: reportMessage
            }
          })
        );
        
        await Promise.all(sendPromises);

        // Atualizar última execução
        await supabase
          .from('ai_weekly_reports')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('company_id', company_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Relatório gerado e enviado com sucesso',
          report: reportMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função AI Collection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});