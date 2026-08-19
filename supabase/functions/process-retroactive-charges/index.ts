import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { company_id } = await req.json()

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Iniciando processamento retroativo para company:', company_id)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar todos os pagamentos 'paid' com contract_id de contratos ativos
    const { data: paidPayments, error: fetchError } = await supabase
      .from('payment_transactions')
      .select(`
        id,
        due_date,
        contract_id,
        client_id,
        company_id,
        amount,
        contracts!inner (
          id,
          status,
          monthly_value,
          end_date
        )
      `)
      .eq('company_id', company_id)
      .eq('status', 'paid')
      .not('contract_id', 'is', null)
      .eq('contracts.status', 'active')

    if (fetchError) {
      console.error('❌ Erro ao buscar pagamentos:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar pagamentos', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Encontrados ${paidPayments?.length || 0} pagamentos pagos com contratos ativos`)

    const results = {
      processed: 0,
      generated: 0,
      already_exists: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const payment of paidPayments || []) {
      results.processed++

      try {
        // Calcular próxima data de vencimento
        if (!payment.due_date) {
          console.log(`⏭️ Pagamento ${payment.id} sem due_date, pulando`)
          results.skipped++
          continue
        }

        const nextDueDate = calculateNextDueDate(payment.due_date)
        console.log(`📅 Pagamento ${payment.id}: due_date=${payment.due_date} -> next=${nextDueDate}`)

        // Verificar se o contrato tem end_date e se a próxima cobrança está dentro do período
        const contract = payment.contracts as any
        if (contract.end_date && new Date(nextDueDate) > new Date(contract.end_date)) {
          console.log(`⏭️ Próxima cobrança (${nextDueDate}) excede end_date do contrato (${contract.end_date}), pulando`)
          results.skipped++
          continue
        }

        // Verificar se já existe cobrança para o próximo período
        const nextMonth = nextDueDate.substring(0, 7) // YYYY-MM
        const { data: existingCharge, error: checkError } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('client_id', payment.client_id)
          .eq('contract_id', payment.contract_id)
          .in('status', ['pending', 'overdue', 'paid'])
          .gte('due_date', `${nextMonth}-01`)
          .lte('due_date', `${nextMonth}-31`)
          .maybeSingle()

        if (checkError) {
          console.error(`❌ Erro ao verificar cobrança existente para ${payment.id}:`, checkError)
          results.errors.push(`Pagamento ${payment.id}: ${checkError.message}`)
          continue
        }

        if (existingCharge) {
          console.log(`✅ Já existe cobrança para ${nextMonth}, pulando`)
          results.already_exists++
          continue
        }

        // Criar nova cobrança
        const { data: newPayment, error: insertError } = await supabase
          .from('payment_transactions')
          .insert({
            company_id: payment.company_id,
            client_id: payment.client_id,
            contract_id: payment.contract_id,
            amount: contract.monthly_value || payment.amount,
            due_date: nextDueDate,
            status: 'pending',
            transaction_type: 'monthly',
            description: `Mensalidade - ${formatMonthYear(nextDueDate)}`
          })
          .select('id')
          .single()

        if (insertError) {
          console.error(`❌ Erro ao criar cobrança para ${payment.id}:`, insertError)
          results.errors.push(`Pagamento ${payment.id}: ${insertError.message}`)
          continue
        }

        // Buscar domínio customizado da empresa
        const { data: company } = await supabase
          .from('companies')
          .select('domain')
          .eq('id', payment.company_id)
          .single();

        // Sanitizar domínio e APP_URL e construir URL correta (evitar barra dupla)
        const appUrl = (Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app').replace(/\/+$/, '');
        const sanitizedDomain = company?.domain 
          ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
          : null;
        const baseUrl = sanitizedDomain ? `https://${sanitizedDomain}` : appUrl;
        const checkoutUrl = `${baseUrl}/checkout/${newPayment.id}`;
        
        await supabase
          .from('payment_transactions')
          .update({ payment_url: checkoutUrl })
          .eq('id', newPayment.id);

        console.log(`✅ Nova cobrança criada: ${newPayment.id} para ${nextDueDate}`)
        results.generated++

      } catch (error) {
        console.error(`❌ Erro processando pagamento ${payment.id}:`, error)
        results.errors.push(`Pagamento ${payment.id}: ${error.message}`)
      }
    }

    console.log('📊 Resultado do processamento:', results)

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateNextDueDate(currentDueDate: string): string {
  const date = new Date(currentDueDate + 'T12:00:00Z')
  const originalDay = date.getUTCDate()
  
  // Avançar 1 mês
  date.setUTCMonth(date.getUTCMonth() + 1)
  
  // Se o dia mudou (ex: 31/01 -> 03/03), ajustar para último dia do mês
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0) // Último dia do mês anterior
  }
  
  return date.toISOString().split('T')[0]
}

function formatMonthYear(dateStr: string): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [year, month] = dateStr.split('-')
  return `${months[parseInt(month) - 1]}/${year}`
}
