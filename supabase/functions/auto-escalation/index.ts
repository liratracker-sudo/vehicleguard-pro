import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Escalation levels based on days overdue
const ESCALATION_LEVELS = {
  MILD: { minDays: 1, maxDays: 5, level: 1, status: 'active', templateField: 'template_post_due' },
  WARNING: { minDays: 6, maxDays: 10, level: 2, status: 'active', templateField: 'template_post_due_warning' },
  URGENT: { minDays: 11, maxDays: 15, level: 3, status: 'warning', templateField: 'template_post_due_urgent' },
  FINAL: { minDays: 16, maxDays: 20, level: 4, status: 'warning', templateField: 'template_post_due_final' },
  SUSPENSION: { minDays: 21, maxDays: 999, level: 5, status: 'suspended', templateField: 'template_suspended' }
};

function getEscalationLevel(daysOverdue: number) {
  if (daysOverdue >= ESCALATION_LEVELS.SUSPENSION.minDays) return ESCALATION_LEVELS.SUSPENSION;
  if (daysOverdue >= ESCALATION_LEVELS.FINAL.minDays) return ESCALATION_LEVELS.FINAL;
  if (daysOverdue >= ESCALATION_LEVELS.URGENT.minDays) return ESCALATION_LEVELS.URGENT;
  if (daysOverdue >= ESCALATION_LEVELS.WARNING.minDays) return ESCALATION_LEVELS.WARNING;
  if (daysOverdue >= ESCALATION_LEVELS.MILD.minDays) return ESCALATION_LEVELS.MILD;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🚀 Auto-escalation processor started');

  try {
    const results = {
      processed: 0,
      statusUpdated: 0,
      notifications: 0,
      errors: 0
    };

    // Get all companies with auto_suspension_enabled
    const { data: companies, error: companiesError } = await supabase
      .from('payment_notification_settings')
      .select('company_id, auto_suspension_enabled, suspension_after_days')
      .eq('active', true);

    if (companiesError) throw companiesError;

    console.log(`📊 Found ${companies?.length || 0} active companies`);

    for (const company of companies || []) {
      try {
        await processCompanyEscalation(company, results);
      } catch (error) {
        console.error(`❌ Error processing company ${company.company_id}:`, error);
        results.errors++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Auto-escalation completed in ${executionTime}ms`, results);

    // Log execution
    await supabase
      .from('cron_execution_logs')
      .insert({
        job_name: 'auto-escalation',
        status: 'success',
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        execution_time_ms: executionTime,
        response_body: JSON.stringify(results)
      });

    return new Response(
      JSON.stringify({ success: true, results, execution_time_ms: executionTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in auto-escalation:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processCompanyEscalation(
  company: { company_id: string; auto_suspension_enabled: boolean; suspension_after_days: number },
  results: { processed: number; statusUpdated: number; notifications: number; errors: number }
) {
  console.log(`\n📦 Processing company ${company.company_id}...`);

  // Get overdue payments for this company
  const today = new Date().toISOString().split('T')[0];
  
  const { data: overduePayments, error: paymentsError } = await supabase
    .from('payment_transactions')
    .select(`
      id,
      amount,
      due_date,
      client_id,
      clients (
        id,
        name,
        phone,
        service_status
      )
    `)
    .eq('company_id', company.company_id)
    .in('status', ['pending', 'overdue'])
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  if (paymentsError) throw paymentsError;

  console.log(`  Found ${overduePayments?.length || 0} overdue payments`);

  // Group payments by client to process each client once
  const clientPayments = new Map<string, typeof overduePayments>();
  
  for (const payment of overduePayments || []) {
    if (!payment.client_id) continue;
    
    if (!clientPayments.has(payment.client_id)) {
      clientPayments.set(payment.client_id, []);
    }
    clientPayments.get(payment.client_id)!.push(payment);
  }

  // Process each client
  for (const [clientId, payments] of clientPayments) {
    try {
      // Find the oldest overdue payment (worst case)
      const oldestPayment = payments.reduce((oldest, current) => {
        return new Date(current.due_date) < new Date(oldest.due_date) ? current : oldest;
      });

      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(oldestPayment.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const escalationLevel = getEscalationLevel(daysOverdue);
      if (!escalationLevel) continue;

      const client = oldestPayment.clients as any;
      const currentStatus = client?.service_status || 'active';
      const newStatus = escalationLevel.status;

      results.processed++;

      // Check if we need to update status
      const shouldUpdateStatus = 
        (newStatus === 'warning' && currentStatus === 'active') ||
        (newStatus === 'suspended' && currentStatus !== 'suspended' && company.auto_suspension_enabled);

      if (shouldUpdateStatus) {
        console.log(`  🔄 Updating client ${clientId} status: ${currentStatus} -> ${newStatus}`);
        
        // Update client status
        const { error: updateError } = await supabase
          .from('clients')
          .update({ service_status: newStatus })
          .eq('id', clientId);

        if (updateError) {
          console.error(`  ❌ Failed to update client status:`, updateError);
          results.errors++;
          continue;
        }

        // Log the escalation
        await supabase
          .from('client_escalation_history')
          .insert({
            company_id: company.company_id,
            client_id: clientId,
            payment_id: oldestPayment.id,
            previous_status: currentStatus,
            new_status: newStatus,
            escalation_level: escalationLevel.level,
            days_overdue: daysOverdue,
            action_type: 'status_changed',
            action_details: `Status alterado automaticamente de "${currentStatus}" para "${newStatus}" após ${daysOverdue} dias de atraso. Débito: R$ ${oldestPayment.amount.toFixed(2)}`
          });

        results.statusUpdated++;
      }

      // Check if we should send an escalated notification
      // Only send if the client has been at this level for exactly the threshold days
      const thresholdDays = [1, 3, 5, 7, 10, 14, 18, 21, 25, 30];
      
      if (thresholdDays.includes(daysOverdue)) {
        // Check if we already sent a notification for this level today
        const today = new Date().toISOString().split('T')[0];
        
        const { data: existingNotification } = await supabase
          .from('client_escalation_history')
          .select('id')
          .eq('client_id', clientId)
          .eq('action_type', 'notification_sent')
          .eq('days_overdue', daysOverdue)
          .gte('created_at', today)
          .limit(1);

        if (!existingNotification?.length) {
          console.log(`  📤 Triggering escalated notification for client ${clientId} (${daysOverdue}d overdue)`);
          
          // Log that we're sending a notification
          await supabase
            .from('client_escalation_history')
            .insert({
              company_id: company.company_id,
              client_id: clientId,
              payment_id: oldestPayment.id,
              new_status: currentStatus,
              escalation_level: escalationLevel.level,
              days_overdue: daysOverdue,
              action_type: 'notification_sent',
              action_details: `Notificação de nível ${escalationLevel.level} enviada (${escalationLevel.templateField})`
            });

          results.notifications++;
        }
      }

    } catch (error) {
      console.error(`  ❌ Error processing client ${clientId}:`, error);
      results.errors++;
    }
  }
}
