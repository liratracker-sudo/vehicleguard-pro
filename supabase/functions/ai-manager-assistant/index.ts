import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { nowInBrasilia, toISODateTimeBR } from "../_shared/timezone.ts";

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

  // Variáveis para garantir resposta
  let supabase: any;
  let manager_phone = '';
  let instance_url = '';
  let api_token = '';
  let instance_name = '';
  let company_id = '';
  
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData = await req.json();
    company_id = requestData.company_id;
    manager_phone = requestData.manager_phone;
    instance_url = requestData.instance_url;
    api_token = requestData.api_token;
    instance_name = requestData.instance_name;
    const message = requestData.message;
    
    console.log('Processando comando do gestor:', { company_id, message, manager_phone });

    // ====== VERIFICAR SE É UMA CONFIRMAÇÃO DE COBRANÇA PENDENTE ======
    const isConfirmation = /^(sim|confirma|confirmo|vai|ok|pode|pode enviar|envia|manda|s|yes|positivo)$/i.test(message.trim());
    const isNegation = /^(n[aã]o|cancela|cancelar|n|nope|negativo)$/i.test(message.trim());
    
    if (isConfirmation || isNegation) {
      // Buscar confirmação pendente mais recente
      const { data: pendingConfirmation } = await supabase
        .from('scheduled_reminders')
        .select('*')
        .eq('company_id', company_id)
        .eq('manager_phone', manager_phone)
        .eq('action_type', 'pending_confirmation')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (pendingConfirmation) {
        const metadata = pendingConfirmation.metadata as any;
        
        if (isConfirmation) {
          console.log('Confirmação recebida para cobrança:', metadata);
          
          // Marcar como processada
          await supabase
            .from('scheduled_reminders')
            .update({ status: 'completed', sent_at: new Date().toISOString() })
            .eq('id', pendingConfirmation.id);
          
          // Executar a cobrança diretamente
          const collectionResult = await supabase.functions.invoke('ai-collection', {
            body: {
              action: 'process_specific_payment',
              company_id,
              payment_id: metadata.payment_id,
              custom_tone: metadata.tone
            }
          });
          
          console.log('Resultado da cobrança confirmada:', collectionResult);
          
          let responseMessage = '';
          
          if (collectionResult.error || !collectionResult.data?.success) {
            const errorMsg = collectionResult.error?.message || collectionResult.data?.error || 'Erro desconhecido';
            responseMessage = `❌ Erro ao enviar cobrança para ${metadata.client_name}: ${errorMsg}`;
          } else {
            // Enviar mensagem via WhatsApp para o cliente
            const generatedMessage = collectionResult.data.generated_message;
            const clientPhone = collectionResult.data.client_phone;
            const clientName = collectionResult.data.client_name || metadata.client_name;
            
            const { data: whatsappSettings } = await supabase
              .from('whatsapp_settings')
              .select('*')
              .eq('company_id', company_id)
              .eq('is_active', true)
              .single();
            
            if (whatsappSettings && clientPhone) {
              const { data: companyDomain } = await supabase
                .from('companies')
                .select('domain')
                .eq('id', company_id)
                .single();
              
              // Sanitiza APP_URL: remove trailing slashes para evitar barra dupla no checkout
              const defaultAppUrl = (Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app').replace(/\/+$/, '');
              // Sanitiza domínio: remove protocolo (http/https) e trailing slashes para evitar URLs duplicadas
              const sanitizedDomain = companyDomain?.domain 
                ? companyDomain.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
                : null;
              const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : defaultAppUrl;
              const paymentLink = `${baseUrl}/checkout/${metadata.payment_id}`;
              
              const fullMessage = `${generatedMessage}\n\n🔗 Acesse aqui: ${paymentLink}`;
              
              const sendResult = await supabase.functions.invoke('whatsapp-evolution', {
                body: {
                  action: 'sendText',
                  instance_url: whatsappSettings.instance_url,
                  api_token: whatsappSettings.api_token,
                  instance_name: whatsappSettings.instance_name,
                  number: clientPhone,
                  message: fullMessage,
                  company_id,
                  linkPreview: false
                }
              });
              
              if (sendResult.data?.success) {
                responseMessage = `✅ Cobrança enviada com sucesso para ${clientName}!`;
              } else {
                responseMessage = `⚠️ Mensagem gerada mas erro ao enviar: ${sendResult.error?.message || 'Falha no envio'}`;
              }
            } else {
              responseMessage = '⚠️ Mensagem gerada mas WhatsApp não configurado ou cliente sem telefone';
            }
          }
          
          // Enviar resposta ao gestor
          await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url,
              api_token,
              instance_name,
              number: manager_phone,
              message: responseMessage,
              company_id
            }
          });
          
          return new Response(
            JSON.stringify({ success: true, response: responseMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Cancelar confirmação
          await supabase
            .from('scheduled_reminders')
            .update({ status: 'cancelled' })
            .eq('id', pendingConfirmation.id);
          
          const cancelMessage = `❌ Cobrança para ${metadata.client_name} cancelada.`;
          
          await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url,
              api_token,
              instance_name,
              number: manager_phone,
              message: cancelMessage,
              company_id
            }
          });
          
          return new Response(
            JSON.stringify({ success: true, response: cancelMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Buscar dados da empresa
    const { data: companyInfo } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    const companyName = companyInfo?.name || 'sua empresa';

    // Buscar todos os clientes da empresa
    const { data: allClients } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', company_id)
      .order('name', { ascending: true });

    // Buscar pagamentos em aberto
    const { data: overduePayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(id, name, phone, email, document, address, status)
      `)
      .eq('company_id', company_id)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true })
      .limit(50);

    // Buscar pagamentos pendentes
    const { data: pendingPayments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id(id, name, phone, email, document, address, status)
      `)
      .eq('company_id', company_id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(50);

    // ====== BUSCAR DESPESAS/CONTAS A PAGAR ======
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_categories:category_id(name)
      `)
      .eq('company_id', company_id)
      .order('due_date', { ascending: true });

    // Separar despesas por status
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const pendingExpenses = allExpenses?.filter((e: any) => e.status === 'pending') || [];
    const overdueExpenses = pendingExpenses.filter((e: any) => new Date(e.due_date) < todayDate);
    const upcomingExpenses = pendingExpenses.filter((e: any) => {
      const dueDate = new Date(e.due_date);
      return dueDate >= todayDate;
    });
    // Despesas vencendo nos próximos 7 dias
    const sevenDaysFromNow = new Date(todayDate);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expensesDueSoon = upcomingExpenses.filter((e: any) => {
      const dueDate = new Date(e.due_date);
      return dueDate <= sevenDaysFromNow;
    });

    // Buscar últimos pagamentos recebidos (com nome do cliente)
    const { data: paidPayments } = await supabase
      .from('payment_transactions')
      .select('amount, paid_at, clients:client_id(name)')
      .eq('company_id', company_id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(30);

    // ====== BUSCAR CONTRATOS ======
    const { data: allContracts } = await supabase
      .from('contracts')
      .select(`
        *,
        clients:client_id(id, name, phone),
        plans:plan_id(name)
      `)
      .eq('company_id', company_id)
      .order('created_at', { ascending: false });

    // Separar contratos por status de assinatura
    const pendingSignatureContracts = allContracts?.filter((c: any) => c.signature_status === 'pending') || [];
    const signedContracts = allContracts?.filter((c: any) => c.signature_status === 'signed') || [];
    const sentContracts = allContracts?.filter((c: any) => c.signature_status === 'sent') || [];

    // Filtrar pagamentos de HOJE
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = paidPayments?.filter(p => p.paid_at?.startsWith(today)) || [];

    // Construir contexto financeiro
    const totalOverdue = overduePayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPending = pendingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const totalPaid = paidPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const overdueDetails = overduePayments?.map(p => ({
      client: p.clients?.name || 'Cliente não identificado',
      client_phone: p.clients?.phone,
      client_email: p.clients?.email,
      client_document: p.clients?.document,
      client_address: p.clients?.address,
      amount: Number(p.amount),
      due_date: p.due_date,
      days_overdue: Math.floor((new Date().getTime() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      id: p.id
    })) || [];

    const pendingDetails = pendingPayments?.map(p => ({
      client: p.clients?.name || 'Cliente não identificado',
      client_phone: p.clients?.phone,
      client_email: p.clients?.email,
      client_document: p.clients?.document,
      client_address: p.clients?.address,
      amount: Number(p.amount),
      due_date: p.due_date,
      days_until_due: Math.ceil((new Date(p.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      id: p.id
    })) || [];

    // ====== CALCULAR TOTAIS DE DESPESAS ======
    const totalExpensesOverdue = overdueExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalExpensesPending = upcomingExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalExpensesDueSoon = expensesDueSoon.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    // Formatar detalhes de despesas
    const overdueExpenseDetails = overdueExpenses.map((e: any, i: number) => ({
      index: i + 1,
      description: e.description,
      supplier: e.supplier_name || 'Não informado',
      category: e.expense_categories?.name || 'Não categorizado',
      amount: Number(e.amount),
      due_date: e.due_date,
      days_overdue: Math.floor((Date.now() - new Date(e.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      id: e.id
    }));

    const upcomingExpenseDetails = expensesDueSoon.map((e: any, i: number) => ({
      index: i + 1,
      description: e.description,
      supplier: e.supplier_name || 'Não informado',
      category: e.expense_categories?.name || 'Não categorizado',
      amount: Number(e.amount),
      due_date: e.due_date,
      days_until_due: Math.ceil((new Date(e.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      id: e.id
    }));

    // Informações dos clientes
    const clientsInfo = allClients?.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      document: c.document,
      address: c.address,
      status: c.status
    })) || [];

    // Data/hora atual no fuso horário do Brasil
    const now = nowInBrasilia();
    const currentDateTime = toISODateTimeBR(now);
    
    // Calcular dia da semana em português
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dayOfWeek = diasSemana[now.getDay()];
    const dayOfWeekNum = now.getDay(); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    const dayNum = now.getDate();
    const monthName = meses[now.getMonth()];
    const year = now.getFullYear();

    // Preparar prompt para a IA
    const systemPrompt = `Você é um assistente de gestão financeira inteligente para ${companyName}.

=======================================================================
🗓️ HOJE É ${dayOfWeek.toUpperCase()}, DIA ${dayNum} DE ${monthName.toUpperCase()} DE ${year}
DATA/HORA ATUAL: ${currentDateTime} (Horário de Brasília - UTC-3)
DIA DA SEMANA ATUAL (NÚMERO): ${dayOfWeekNum} (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)
=======================================================================

INSTRUÇÕES PARA CÁLCULO DE DATAS (MUITO IMPORTANTE):
- HOJE é ${dayOfWeek}, ${dayNum}/${now.getMonth() + 1}/${year}
- Para calcular "próxima segunda-feira": se hoje é ${dayOfWeek} (${dayOfWeekNum}), adicione ${(1 - dayOfWeekNum + 7) % 7 || 7} dias
- Para calcular "próxima terça-feira": adicione ${(2 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- Para calcular "próxima quarta-feira": adicione ${(3 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- Para calcular "próxima quinta-feira": adicione ${(4 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- Para calcular "próxima sexta-feira": adicione ${(5 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- Para calcular "próximo sábado": adicione ${(6 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- Para calcular "próximo domingo": adicione ${(0 - dayOfWeekNum + 7) % 7 || 7} dias a partir de hoje
- SEMPRE verifique o dia da semana antes de calcular datas!

Use SEMPRE esta data/hora como referência para interpretar comandos como "amanhã", "hoje", "daqui a 2 dias", "segunda-feira", etc.

Suas capacidades:
1. Fornecer informações completas sobre clientes, cobranças, pagamentos e situação financeira
2. Acessar dados cadastrais de todos os clientes (nome, telefone, email, documento, endereço)
3. **CONTAS A PAGAR**: Informar sobre despesas, fornecedores e pagamentos pendentes
4. **CONTRATOS**: Informar sobre contratos pendentes de assinatura, contratos assinados, contratos enviados
5. Executar ações quando solicitado pelo gestor:
   - Forçar cobrança de clientes inadimplentes (enviar mensagem de cobrança via IA)
   - Gerar relatórios financeiros (contas a receber E a pagar)
   - Listar clientes com pagamentos em atraso
   - **Listar contas a pagar vencidas e próximas do vencimento**
   - Fornecer informações detalhadas sobre qualquer cliente
   - **AGENDAR LEMBRETES**: Criar lembretes para horários específicos
   - **AGENDAR COBRANÇAS**: Programar cobranças automáticas para datas/horários específicos
   - **AGENDAR LEMBRETES DE PAGAMENTO A FORNECEDORES**: Lembrar de pagar contas

======== CONTAS A RECEBER (CLIENTES) ========
- Total em atraso: R$ ${totalOverdue.toFixed(2)} (${overduePayments?.length || 0} cobranças)
- Total pendente: R$ ${totalPending.toFixed(2)} (${pendingPayments?.length || 0} cobranças)
- Total recebido (últimos 30): R$ ${totalPaid.toFixed(2)}
- Total de clientes cadastrados: ${allClients?.length || 0}

======== CONTAS A PAGAR (DESPESAS/FORNECEDORES) ========
- Total VENCIDO: R$ ${totalExpensesOverdue.toFixed(2)} (${overdueExpenses.length} contas)
- Total a vencer (próx. 7 dias): R$ ${totalExpensesDueSoon.toFixed(2)} (${expensesDueSoon.length} contas)
- Total pendente (todas): R$ ${totalExpensesPending.toFixed(2)} (${upcomingExpenses.length} contas)

CONTAS VENCIDAS:
${overdueExpenseDetails.length > 0 
  ? overdueExpenseDetails.map((e: any) => {
      const statusDia = e.days_overdue === 0 ? 'venceu hoje' : 
                        e.days_overdue === 1 ? '1d atraso' : 
                        `${e.days_overdue}d atraso`;
      return `${e.index}. ${e.description}${e.supplier ? ` (${e.supplier})` : ''} - R$ ${e.amount.toFixed(2)} | ${e.due_date.split('-').slice(1).reverse().join('/')} | ${statusDia} [ID:${e.id}]`;
    }).join('\n')
  : 'Nenhuma'}

A VENCER:
${upcomingExpenseDetails.length > 0 
  ? upcomingExpenseDetails.map((e: any) => {
      const statusDia = e.days_until_due === 0 ? 'vence hoje' :
                        e.days_until_due === 1 ? 'vence amanhã' :
                        `vence em ${e.days_until_due}d`;
      return `${e.index}. ${e.description}${e.supplier ? ` (${e.supplier})` : ''} - R$ ${e.amount.toFixed(2)} | ${e.due_date.split('-').slice(1).reverse().join('/')} | ${statusDia} [ID:${e.id}]`;
    }).join('\n')
  : 'Nenhuma'}

======== CONTRATOS ========
- Pendentes de assinatura: ${pendingSignatureContracts.length} contratos
- Enviados aguardando assinatura: ${sentContracts.length} contratos  
- Assinados: ${signedContracts.length} contratos
- Total de contratos: ${allContracts?.length || 0}

CONTRATOS PENDENTES DE ASSINATURA:
${pendingSignatureContracts.length > 0
  ? pendingSignatureContracts.map((c: any, i: number) => 
      `${i + 1}. ${c.clients?.name || 'Cliente não identificado'} - ${c.plans?.name || 'Plano não identificado'} - R$ ${Number(c.monthly_value).toFixed(2)}/mês - Início: ${c.start_date}`
    ).join('\n')
  : 'Nenhum contrato pendente de assinatura'}

CONTRATOS ENVIADOS (AGUARDANDO ASSINATURA DO CLIENTE):
${sentContracts.length > 0
  ? sentContracts.map((c: any, i: number) => 
      `${i + 1}. ${c.clients?.name || 'Cliente não identificado'} - ${c.plans?.name || 'Plano não identificado'} - R$ ${Number(c.monthly_value).toFixed(2)}/mês - Tel: ${c.clients?.phone || 'N/A'}`
    ).join('\n')
  : 'Nenhum contrato aguardando assinatura'}

CONTRATOS ASSINADOS RECENTEMENTE:
${signedContracts.slice(0, 5).length > 0
  ? signedContracts.slice(0, 5).map((c: any, i: number) => 
      `${i + 1}. ${c.clients?.name || 'Cliente não identificado'} - ${c.plans?.name || 'Plano não identificado'} - Assinado em: ${c.signed_at ? new Date(c.signed_at).toLocaleDateString('pt-BR') : 'N/A'}`
    ).join('\n')
  : 'Nenhum contrato assinado recentemente'}

PAGAMENTOS RECEBIDOS HOJE (${today}):
${todayPayments.length > 0 
  ? todayPayments.map((p: any) => `- ${p.clients?.name || 'Cliente'}: R$ ${Number(p.amount).toFixed(2)} (pago às ${p.paid_at?.split('T')[1]?.substring(0,5) || ''})`).join('\n')
  : 'Nenhum pagamento recebido hoje ainda'}

Clientes cadastrados (completo):
${clientsInfo.map((c, i) => `${i + 1}. ${c.name}
   - Telefone: ${c.phone || 'Não informado'}
   - Email: ${c.email || 'Não informado'}
   - Documento: ${c.document || 'Não informado'}
   - Endereço: ${c.address || 'Não informado'}
   - Status: ${c.status}
   - ID: ${c.id}`).join('\n') || 'Nenhum cliente cadastrado'}

Cobranças em atraso (detalhado):
${overdueDetails.map((p, i) => `${i + 1}. ${p.client}
   - Telefone: ${p.client_phone || 'Não informado'}
   - Email: ${p.client_email || 'Não informado'}
   - Documento: ${p.client_document || 'Não informado'}
   - Endereço: ${p.client_address || 'Não informado'}
   - Valor: R$ ${p.amount.toFixed(2)}
   - Vencimento: ${p.due_date}
   - Dias em atraso: ${p.days_overdue}
   - ID do pagamento: ${p.id}`).join('\n\n') || 'Nenhuma cobrança em atraso'}

Cobranças pendentes (não vencidas ainda):
${pendingDetails.map((p, i) => `${i + 1}. ${p.client}
   - Telefone: ${p.client_phone || 'Não informado'}
   - Email: ${p.client_email || 'Não informado'}
   - Documento: ${p.client_document || 'Não informado'}
   - Endereço: ${p.client_address || 'Não informado'}
   - Valor: R$ ${p.amount.toFixed(2)}
   - Vencimento: ${p.due_date}
   - Dias até vencer: ${p.days_until_due}
   - ID do pagamento: ${p.id}`).join('\n\n') || 'Nenhuma cobrança pendente'}

REGRAS IMPORTANTES:
- NUNCA use LaTeX, fórmulas matemáticas ou código de programação nas respostas
- Seja direto, objetivo e profissional
- Use apenas texto simples e números formatados como "R$ 100,00" ou "50%"
- Para cálculos, apresente apenas o RESULTADO final de forma clara
- Exemplo CORRETO: "A taxa de inadimplência é 50% (20 em atraso de 40 clientes total)"
- Exemplo ERRADO: "\\frac{20}{40} \\times 100 = 50%"
- VOCÊ PRECISA SEMPRE RESPONDER, NUNCA FIQUE SILENCIOSO

FORMATAÇÃO DE CONTAS A PAGAR:
- SEMPRE responda contas a pagar em formato COMPACTO de UMA LINHA por conta
- Use o formato: "1. DESCRIÇÃO (FORNECEDOR) - R$ VALOR | DD/MM | STATUS"
- NUNCA expanda para múltiplas linhas com "Fornecedor:", "Valor:", etc.
- NUNCA mostre o ID das despesas na resposta ao usuário
- Mantenha a resposta limpa e objetiva

FLUXO DE COBRANÇA COM CONFIRMAÇÃO:
1. Quando o gestor pedir para cobrar um cliente, PRIMEIRO identifique o cliente e mostre os dados
2. Use o comando AGUARDANDO_CONFIRMACAO para pedir confirmação antes de enviar
3. Só execute EXECUTAR_COBRANCA quando o gestor confirmar com "sim", "confirma", "vai", "ok", "pode enviar", etc.

COMANDOS ESPECIAIS:
- Para SOLICITAR CONFIRMAÇÃO antes de cobrar: Use "AGUARDANDO_CONFIRMACAO:ID:NOME_CLIENTE:VALOR:TOM"
  * Isso vai mostrar os dados do cliente e perguntar "Confirma o envio?"
  * Exemplo: AGUARDANDO_CONFIRMACAO:550e8400-e29b-41d4-a716-446655440000:João Silva:150.00:agressivo
  * Se não houver tom específico, omita: AGUARDANDO_CONFIRMACAO:550e8400-e29b-41d4-a716-446655440000:João Silva:150.00

- Para forçar cobrança IMEDIATA (após confirmação): Use "EXECUTAR_COBRANCA:ID:TOM" onde:
  * ID = o ID REAL do pagamento (UUID) listado acima
  * TOM = tom solicitado pelo gestor (agressivo, amigavel, formal, urgente, firme, muito_agressivo) - OPCIONAL
  * ATENÇÃO: SEMPRE use o ID REAL do pagamento, NUNCA use "ID_DO_PAGAMENTO" como placeholder

- Para gerar relatório: "EXECUTAR_RELATORIO"
- Para agendar lembrete: "AGENDAR_LEMBRETE:YYYY-MM-DD HH:MM:MENSAGEM" (exemplo: "AGENDAR_LEMBRETE:2025-10-09 09:00:Atualizar base de dados")
- Para agendar cobrança: "AGENDAR_COBRANCA:YYYY-MM-DD HH:MM:ID_REAL_DO_PAGAMENTO" - use sempre o ID real do pagamento, não o placeholder
- Para agendar lembrete de pagamento a fornecedor: "AGENDAR_LEMBRETE_FORNECEDOR:YYYY-MM-DD HH:MM:DESCRICAO_DA_DESPESA:VALOR" (exemplo: "AGENDAR_LEMBRETE_FORNECEDOR:2025-12-10 09:00:CHIP VOXTER:740.00")
- Para outras perguntas, responda normalmente com TODAS as informações disponíveis em linguagem natural

REGRA DE CONFIRMAÇÃO:
- Se o gestor disser "sim", "confirma", "vai", "ok", "pode enviar", "envia", "manda", "confirmo" E houver uma cobrança pendente de confirmação no contexto recente, execute EXECUTAR_COBRANCA diretamente

IMPORTANTE SOBRE DATAS:
- A data/hora atual no Brasil é: ${currentDateTime}
- Ao interpretar "amanhã", adicione 1 dia à data atual
- Ao interpretar "hoje", use a data atual
- SEMPRE use o horário de Brasília (UTC-3) nas datas agendadas
- Quando o gestor solicitar lembretes ou cobranças futuras, SEMPRE use os comandos de agendamento acima

EXEMPLOS DE PERGUNTAS SOBRE CONTAS A PAGAR:
- "Quais contas a pagar eu tenho?" → Liste as despesas pendentes e vencidas
- "O que vence essa semana?" → Mostre as despesas dos próximos 7 dias
- "Quanto tenho a pagar para fornecedores?" → Informe o total pendente
- "Me lembra de pagar a VOXTER amanhã às 9h" → Use AGENDAR_LEMBRETE_FORNECEDOR

EXEMPLOS DE PERGUNTAS SOBRE CONTRATOS:
- "Quais contratos estão pendentes de assinatura?" → Liste os contratos com signature_status = pending
- "Quantos contratos foram assinados?" → Informe a quantidade de contratos assinados
- "Quem não assinou o contrato ainda?" → Liste clientes com contratos pendentes ou enviados
- "Status dos contratos" → Mostre o resumo de todos os contratos por status`;

    // Detectar se é um pedido de lembrete para não oferecer web_search
    const isReminderRequest = /\b(lembra|lembre|avisa|alerta|notifica|agenda)\b/i.test(message);
    
    const userPrompt = `Mensagem do gestor: "${message}"

Analise a solicitação e responda adequadamente:

1. Se for um pedido de LEMBRETE (ex: "me lembra", "lembre-me", "agendar lembrete"), use o comando AGENDAR_LEMBRETE no formato:
   AGENDAR_LEMBRETE:YYYY-MM-DD HH:MM:MENSAGEM
   Exemplo: AGENDAR_LEMBRETE:2025-10-09 14:10:Atualizar a base

2. Se for solicitação para DISPARAR/FORÇAR COBRANÇA:
   a) PRIMEIRO, identifique o cliente e mostre os dados, depois PEÇA CONFIRMAÇÃO usando:
      AGUARDANDO_CONFIRMACAO:UUID_DO_PAGAMENTO:NOME_DO_CLIENTE:VALOR:TOM_OPCIONAL
      Exemplo: AGUARDANDO_CONFIRMACAO:550e8400-e29b-41d4-a716-446655440000:João Silva:150.00:agressivo
      
   b) EXCEÇÃO: Se o gestor já confirmou anteriormente (disse "sim", "confirma", "vai", "ok", "pode enviar", "envia", "manda", "confirmo", "pode"),
      então use EXECUTAR_COBRANCA diretamente:
      EXECUTAR_COBRANCA:UUID:TOM_OPCIONAL
      
   - Tons disponíveis: agressivo, muito_agressivo, amigavel, formal, urgente, firme

3. Se for uma solicitação de gerar relatório, use: EXECUTAR_RELATORIO

4. Se for pergunta sobre clientes, pagamentos ou finanças da empresa, responda com os dados fornecidos

5. Se a mensagem for uma CONFIRMAÇÃO (como "sim", "confirma", "vai", "ok", "pode enviar", "envia", "manda", "confirmo", "pode"):
   - Verifique se há alguma cobrança que foi identificada recentemente
   - Se houver, execute EXECUTAR_COBRANCA com o ID do pagamento identificado anteriormente

6. Se for pergunta sobre CONTAS A PAGAR, DESPESAS ou FORNECEDORES:
   - Liste as contas a pagar vencidas e/ou próximas do vencimento
   - Informe fornecedor, valor, vencimento e categoria
   - Para agendar lembrete de pagamento a fornecedor, use:
     AGENDAR_LEMBRETE_FORNECEDOR:YYYY-MM-DD HH:MM:DESCRICAO:VALOR
     Exemplo: AGENDAR_LEMBRETE_FORNECEDOR:2025-12-15 09:00:CHIP VOXTER:740.00

CRÍTICO: 
- Quando usar comandos como EXECUTAR_COBRANCA, AGENDAR_COBRANCA ou AGUARDANDO_CONFIRMACAO, SEMPRE extraia e use o ID REAL do pagamento do contexto fornecido
- NUNCA deixe "ID_DO_PAGAMENTO" como placeholder
- SEMPRE peça confirmação antes de enviar uma cobrança, a menos que o gestor já tenha confirmado

Importante: Para lembretes, SEMPRE use o horário de Brasília e a data/hora atual é: \${currentDateTime}`;

    // Chamar OpenAI API com function calling
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let aiResponse = '';
    let shouldContinue = true;
    let iterationCount = 0;
    const maxIterations = 3;

    // Tentar chamar a IA com tratamento de erro robusto
    try {
      while (shouldContinue && iterationCount < maxIterations) {
        iterationCount++;
        
        const requestBody: any = {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.3,
        };

        // Só incluir web_search se NÃO for pedido de lembrete
        if (!isReminderRequest) {
          requestBody.tools = [
            {
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Busca informações na internet quando a resposta não está nos dados da empresa. Use apenas para informações gerais, notícias, dados públicos.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Consulta de busca em português ou inglês'
                    }
                  },
                  required: ['query']
                }
              }
            }
          ];
          requestBody.tool_choice = 'auto';
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const aiData = await response.json();
        
        if (!response.ok) {
          console.error('Erro na chamada OpenAI:', aiData);
          throw new Error(aiData.error?.message || 'Erro ao chamar OpenAI API');
        }

        const choice = aiData.choices[0];
        
        // Se o modelo quer usar uma ferramenta
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          console.log('GPT solicitou busca na web');
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.function.name === 'web_search') {
              const args = JSON.parse(toolCall.function.arguments);
              console.log('Buscando na web:', args.query);
              
              try {
                // Buscar usando DuckDuckGo
                const searchQuery = encodeURIComponent(args.query);
                const searchResponse = await fetch(
                  `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`
                );
                
                const searchData = await searchResponse.json();
                
                // Extrair resultados relevantes
                let searchResults = '';
                
                if (searchData.AbstractText) {
                  searchResults += `Resumo: ${searchData.AbstractText}\n\n`;
                }
                
                if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
                  searchResults += 'Informações encontradas:\n';
                  searchData.RelatedTopics.slice(0, 5).forEach((topic: any, idx: number) => {
                    if (topic.Text) {
                      searchResults += `${idx + 1}. ${topic.Text}\n`;
                    }
                  });
                }
                
                if (!searchResults) {
                  searchResults = 'Não foram encontrados resultados específicos. Tente reformular a pergunta ou buscar informações mais específicas da empresa.';
                }
                
                // Adicionar resultado da busca às mensagens
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: searchResults
                });
                
                console.log('Resultados da busca:', searchResults.substring(0, 200));
              } catch (searchError) {
                console.error('Erro na busca web:', searchError);
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: 'Desculpe, não foi possível buscar informações na internet no momento. Posso ajudar com informações sobre os clientes e pagamentos da empresa.'
                });
              }
            }
          }
        } else {
          // Resposta final do modelo
          aiResponse = choice.message.content;
          shouldContinue = false;
        }
      }
    } catch (aiError) {
      console.error('Erro crítico ao chamar IA:', aiError);
      // Fallback em caso de erro na IA
      aiResponse = 'Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes ou reformule sua pergunta de forma mais simples.';
    }
    
    console.log('Resposta da IA:', aiResponse);

    // Processar comandos
    let finalResponse = aiResponse;
    
    // Garantir que sempre há uma resposta
    if (!finalResponse || finalResponse.trim() === '') {
      finalResponse = 'Olá! Estou aqui para ajudar. Como posso auxiliá-lo com as cobranças e gestão dos clientes?';
      console.log('Resposta vazia detectada, usando fallback');
    }
    
    // ====== DETECTAR TOM DIRETAMENTE DA MENSAGEM DO GESTOR ======
    let detectedTone: string | null = null;
    const tonePatterns: [string, RegExp][] = [
      ['muito_agressivo', /muito\s*agressivo|super\s*agressivo|extremamente\s*agressivo|bem\s*agressivo/i],
      ['agressivo', /tom\s*agressivo|seja\s*agressivo|mais\s*agressivo|com\s*agressivo|agressivo\s*com/i],
      ['amigavel', /tom\s*amig[aá]vel|seja\s*amig[aá]vel|gentil|educad[oa]/i],
      ['formal', /tom\s*formal|seja\s*formal|profissional/i],
      ['urgente', /tom\s*urgente|seja\s*urgente|urg[eê]ncia/i],
      ['firme', /tom\s*firme|seja\s*firme/i]
    ];

    for (const [tone, pattern] of tonePatterns) {
      if (pattern.test(message)) {
        detectedTone = tone;
        console.log('🎯 Tom detectado na mensagem do gestor:', detectedTone);
        break;
      }
    }
    
    // ====== DETECTAR COMANDO DE CONFIRMAÇÃO PENDENTE ======
    const confirmationMatch = aiResponse.match(/AGUARDANDO_CONFIRMACAO:([a-f0-9-]+):([^:]+):([0-9.]+)(?::([^\s]+))?/);
    if (confirmationMatch) {
      const [, paymentId, clientName, amount, tone] = confirmationMatch;
      console.log('Solicitando confirmação para cobrança:', { paymentId, clientName, amount, tone });
      
      // Salvar estado de confirmação pendente na tabela scheduled_reminders como metadata
      try {
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: `Confirmação pendente: ${clientName}`,
            scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Expira em 30 min
            action_type: 'pending_confirmation',
            status: 'pending',
            metadata: { 
              payment_id: paymentId, 
              client_name: clientName, 
              amount: parseFloat(amount),
              tone: tone || detectedTone || null
            }
          });
        
        // Formatar mensagem de confirmação
        const toneText = tone || detectedTone ? ` (tom: ${tone || detectedTone})` : '';
        const confirmationMessage = `📋 *Confirma o envio da cobrança?*

👤 Cliente: ${clientName}
💰 Valor: R$ ${parseFloat(amount).toFixed(2)}${toneText}

Responda *SIM* para confirmar ou *NÃO* para cancelar.`;
        
        finalResponse = aiResponse.replace(/AGUARDANDO_CONFIRMACAO:[^\n]+/, confirmationMessage);
      } catch (error) {
        console.error('Erro ao salvar confirmação pendente:', error);
        finalResponse = aiResponse.replace(/AGUARDANDO_CONFIRMACAO:[^\n]+/, '❌ Erro ao processar solicitação de cobrança.');
      }
    }
    
    // Detectar comando de cobrança (agora com suporte a tom customizado)
    const forceCollectionMatch = aiResponse.match(/EXECUTAR_COBRANCA:([a-f0-9-]+)(?::([^\s]+))?/);
    if (forceCollectionMatch) {
      const paymentId = forceCollectionMatch[1];
      // Prioridade: tom do comando > tom detectado na mensagem
      const customTone = forceCollectionMatch[2] || detectedTone;
      console.log('Executando cobrança para pagamento:', paymentId, 'com tom:', customTone || 'padrão');
      
      // Invocar função de cobrança individual (apenas gera a mensagem)
      const collectionResult = await supabase.functions.invoke('ai-collection', {
        body: {
          action: 'process_specific_payment',
          company_id,
          payment_id: paymentId,
          custom_tone: customTone  // Passa o tom customizado se especificado
        }
      });
      
      console.log('Resultado da cobrança:', collectionResult);
      
      // Verificar se houve erro ou sucesso
      if (collectionResult.error || !collectionResult.data?.success) {
        const errorMsg = collectionResult.error?.message || collectionResult.data?.error || 'Erro desconhecido';
        console.error('Erro ao executar cobrança:', errorMsg);
        finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `❌ Erro ao enviar cobrança: ${errorMsg}`);
      } else {
        // AGORA PRECISAMOS ENVIAR A MENSAGEM VIA WHATSAPP
        const generatedMessage = collectionResult.data.generated_message;
        const clientPhone = collectionResult.data.client_phone;
        const clientName = collectionResult.data.client_name;
        
        console.log('Mensagem gerada, enviando para cliente:', clientName, clientPhone);
        
        // Buscar configurações do WhatsApp
        const { data: whatsappSettings } = await supabase
          .from('whatsapp_settings')
          .select('*')
          .eq('company_id', company_id)
          .eq('is_active', true)
          .single();
        
        if (whatsappSettings && clientPhone) {
          // Buscar informações da empresa para o link
          const { data: companyInfo } = await supabase
            .from('companies')
            .select('domain')
            .eq('id', company_id)
            .single();
          
          const defaultAppUrl = Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app';
          const baseUrl = companyInfo?.domain 
            ? `https://${companyInfo.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')}` 
            : defaultAppUrl;
          const paymentLink = `${baseUrl}/checkout/${paymentId}`;
          
          // Construir mensagem completa com link
          const fullMessage = `${generatedMessage}\n\n🔗 Acesse aqui: ${paymentLink}`;
          
          // Enviar via WhatsApp
          const sendResult = await supabase.functions.invoke('whatsapp-evolution', {
            body: {
              action: 'sendText',
              instance_url: whatsappSettings.instance_url,
              api_token: whatsappSettings.api_token,
              instance_name: whatsappSettings.instance_name,
              number: clientPhone,
              message: fullMessage,
              company_id,
              linkPreview: false
            }
          });
          
          console.log('Resultado do envio WhatsApp:', sendResult);
          
          if (sendResult.data?.success) {
            finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `✅ Cobrança enviada com sucesso para ${clientName}!`);
          } else {
            finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, `⚠️ Mensagem gerada mas erro ao enviar: ${sendResult.error?.message || 'Falha no envio'}`);
          }
        } else {
          console.error('WhatsApp não configurado ou cliente sem telefone');
          finalResponse = aiResponse.replace(/EXECUTAR_COBRANCA:[a-f0-9-]+/, '⚠️ Mensagem gerada mas WhatsApp não configurado ou cliente sem telefone');
        }
      }
    }

    // Detectar comando de relatório
    if (aiResponse.includes('EXECUTAR_RELATORIO')) {
      console.log('Gerando relatório financeiro');
      
      try {
        const reportResult = await supabase.functions.invoke('ai-collection', {
          body: {
            action: 'generate_weekly_report',
            company_id
          }
        });
        
        finalResponse = aiResponse.replace('EXECUTAR_RELATORIO', '✅ Relatório gerado acima!');
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        finalResponse = aiResponse.replace('EXECUTAR_RELATORIO', '❌ Erro ao gerar relatório.');
      }
    }

    // Detectar comando de agendar lembrete
    const reminderMatch = aiResponse.match(/AGENDAR_LEMBRETE:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):(.+)/);
    if (reminderMatch) {
      const [, scheduledTime, reminderText] = reminderMatch;
      console.log('Agendando lembrete:', { scheduledTime, reminderText });
      
      try {
        // Converter horário de Brasília para UTC para armazenar no banco
        const brasiliaDateStr = scheduledTime + ':00-03:00';
        const brasiliaDate = new Date(brasiliaDateStr);
        
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: reminderText.trim(),
            scheduled_for: brasiliaDate.toISOString(),
            action_type: 'reminder'
          });
        
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE:[^\n]+/, `✅ Lembrete agendado para ${scheduledTime} (Horário de Brasília)!`);
      } catch (error) {
        console.error('Erro ao agendar lembrete:', error);
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE:[^\n]+/, '❌ Erro ao agendar lembrete.');
      }
    }

    // Detectar comando de agendar lembrete de pagamento a fornecedor
    const supplierReminderMatch = aiResponse.match(/AGENDAR_LEMBRETE_FORNECEDOR:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):([^:]+):([0-9.]+)/);
    if (supplierReminderMatch) {
      const [, scheduledTime, expenseDescription, amount] = supplierReminderMatch;
      console.log('Agendando lembrete de pagamento a fornecedor:', { scheduledTime, expenseDescription, amount });
      
      try {
        // Converter horário de Brasília para UTC para armazenar no banco
        const brasiliaDateStr = scheduledTime + ':00-03:00';
        const brasiliaDate = new Date(brasiliaDateStr);
        
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: `💰 Lembrete de pagamento:\n📋 ${expenseDescription.trim()}\n💵 Valor: R$ ${parseFloat(amount).toFixed(2)}`,
            scheduled_for: brasiliaDate.toISOString(),
            action_type: 'supplier_payment',
            metadata: { expense_description: expenseDescription.trim(), amount: parseFloat(amount) }
          });
        
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE_FORNECEDOR:[^\n]+/, `✅ Lembrete de pagamento agendado para ${scheduledTime}!\n📋 ${expenseDescription.trim()} - R$ ${parseFloat(amount).toFixed(2)}`);
      } catch (error) {
        console.error('Erro ao agendar lembrete de fornecedor:', error);
        finalResponse = aiResponse.replace(/AGENDAR_LEMBRETE_FORNECEDOR:[^\n]+/, '❌ Erro ao agendar lembrete de pagamento.');
      }
    }

    // Detectar comando de agendar cobrança
    const scheduleCollectionMatch = aiResponse.match(/AGENDAR_COBRANCA:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):([a-f0-9-]+)/);
    if (scheduleCollectionMatch) {
      const [, scheduledTime, paymentId] = scheduleCollectionMatch;
      console.log('Agendando cobrança:', { scheduledTime, paymentId });
      
      try {
        // Converter horário de Brasília para UTC para armazenar no banco
        const brasiliaDateStr = scheduledTime + ':00-03:00';
        const brasiliaDate = new Date(brasiliaDateStr);
        
        await supabase
          .from('scheduled_reminders')
          .insert({
            company_id,
            manager_phone,
            reminder_text: `Cobrança automática agendada`,
            scheduled_for: brasiliaDate.toISOString(),
            action_type: 'collection',
            metadata: { payment_id: paymentId }
          });
        
        finalResponse = aiResponse.replace(/AGENDAR_COBRANCA:[^\n]+/, `✅ Cobrança agendada para ${scheduledTime} (Horário de Brasília)!`);
      } catch (error) {
        console.error('Erro ao agendar cobrança:', error);
        finalResponse = aiResponse.replace(/AGENDAR_COBRANCA:[^\n]+/, '❌ Erro ao agendar cobrança.');
      }
    }

    // Enviar resposta via WhatsApp
    await supabase.functions.invoke('whatsapp-evolution', {
      body: {
        action: 'sendText',
        instance_url,
        api_token,
        instance_name,
        number: manager_phone,
        message: finalResponse,
        company_id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        response: finalResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro crítico no assistente do gestor:', error);
    
    // SEMPRE tentar enviar uma mensagem de erro ao gestor
    const errorMessage = '❌ Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente em alguns instantes.';
    
    try {
      // Tentar enviar mensagem de erro via WhatsApp se temos as credenciais
      if (supabase && manager_phone && instance_url && api_token && instance_name) {
        console.log('Enviando mensagem de erro ao gestor via WhatsApp');
        await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'sendText',
            instance_url,
            api_token,
            instance_name,
            number: manager_phone,
            message: errorMessage,
            company_id
          }
        });
      }
    } catch (whatsappError) {
      console.error('Erro ao enviar mensagem de erro via WhatsApp:', whatsappError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        message: 'Erro processado e usuário notificado'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
