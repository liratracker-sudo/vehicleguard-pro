import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Próxima data de vencimento (+1 mês, mantendo o dia quando possível)
function calculateNextDueDate(currentDueDate: string): string {
  const date = new Date(currentDueDate + 'T12:00:00Z');
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + 1);
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }
  return date.toISOString().split('T')[0];
}

function monthWindow(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + 'T12:00:00Z');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0];
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0];
  return { start, end };
}

function formatMonthYear(dateStr: string): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [year, month] = dateStr.split('-');
  return `${months[parseInt(month) - 1]}/${year}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = new Date().toISOString();

  const results = {
    checked: 0,
    created: 0,
    already_exists: 0,
    skipped: 0,
    errors: [] as string[],
    created_ids: [] as string[],
  };

  try {
    let lookbackDays = 60;
    let companyId: string | null = null;
    try {
      const body = await req.json();
      if (body?.lookback_days) lookbackDays = Number(body.lookback_days);
      if (body?.company_id) companyId = body.company_id;
    } catch (_) { /* sem body */ }

    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    console.log(`🔄 Reconciliando cobranças de pagamentos pagos desde ${since}`);

    let query = supabase
      .from('payment_transactions')
      .select(`
        id, company_id, client_id, contract_id, amount, due_date, transaction_type, description,
        contracts!inner(id, status, monthly_value, end_date)
      `)
      .eq('status', 'paid')
      .not('contract_id', 'is', null)
      .gte('paid_at', since)
      .eq('contracts.status', 'active')
      .order('paid_at', { ascending: true });

    if (companyId) query = query.eq('company_id', companyId);

    const { data: paidPayments, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    console.log(`📋 ${paidPayments?.length || 0} pagamentos elegíveis`);

    // Cache de domínio por empresa
    const domainCache = new Map<string, string>();
    const appUrl = (Deno.env.get('APP_URL') || 'https://appliratracker.lovable.app').replace(/\/+$/, '');

    for (const payment of paidPayments || []) {
      results.checked++;
      try {
        if (!payment.due_date) {
          results.skipped++;
          continue;
        }

        const contract = payment.contracts as any;
        const nextDueDate = calculateNextDueDate(payment.due_date);

        if (contract.end_date && nextDueDate > contract.end_date) {
          results.skipped++;
          continue;
        }

        const { start, end } = monthWindow(nextDueDate);

        const { data: existing, error: existingError } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('client_id', payment.client_id)
          .eq('contract_id', payment.contract_id)
          .in('status', ['pending', 'overdue', 'paid'])
          .gte('due_date', start)
          .lte('due_date', end)
          .limit(1);

        if (existingError) throw existingError;

        if (existing && existing.length > 0) {
          results.already_exists++;
          continue;
        }

        const amount = contract.monthly_value || payment.amount;

        const { data: newPayment, error: insertError } = await supabase
          .from('payment_transactions')
          .insert({
            company_id: payment.company_id,
            client_id: payment.client_id,
            contract_id: payment.contract_id,
            amount,
            due_date: nextDueDate,
            status: 'pending',
            transaction_type: payment.transaction_type || 'monthly',
            description: `Mensalidade - ${formatMonthYear(nextDueDate)}`,
            payment_gateway: null,
            external_id: null,
            pix_code: null,
            barcode: null,
          })
          .select('id')
          .single();

        if (insertError || !newPayment) throw insertError;

        if (!domainCache.has(payment.company_id)) {
          const { data: company } = await supabase
            .from('companies')
            .select('domain')
            .eq('id', payment.company_id)
            .maybeSingle();
          const sanitized = company?.domain
            ? company.domain.replace(/^https?:\/+/i, '').replace(/\/+$/, '')
            : null;
          domainCache.set(payment.company_id, sanitized ? `https://${sanitized}` : appUrl);
        }

        const checkoutUrl = `${domainCache.get(payment.company_id)}/checkout/${newPayment.id}`;
        await supabase
          .from('payment_transactions')
          .update({ payment_url: checkoutUrl })
          .eq('id', newPayment.id);

        results.created++;
        results.created_ids.push(newPayment.id);
        console.log(`✅ Cobrança criada ${newPayment.id} venc. ${nextDueDate} (R$ ${amount})`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Erro no pagamento ${payment.id}:`, msg);
        results.errors.push(`${payment.id}: ${msg}`);
      }
    }

    await supabase.from('cron_execution_logs').insert({
      job_name: 'reconcile-next-charges',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: results.errors.length > 0 ? 'partial' : 'success',
      details: results,
    });

    console.log('📊 Resultado:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro geral em reconcile-next-charges:', msg);

    await supabase.from('cron_execution_logs').insert({
      job_name: 'reconcile-next-charges',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error',
      details: { error: msg, ...results },
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
