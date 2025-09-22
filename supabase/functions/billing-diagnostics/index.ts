import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting billing diagnostics...');
    
    const diagnostics = {
      companies_with_settings: 0,
      overdue_payments: 0,
      pending_notifications: 0,
      failed_notifications: 0,
      companies: [] as any[],
      actions_taken: [] as string[]
    };

    // 1. Check companies with notification settings
    const { data: companiesSettings, error: settingsError } = await supabase
      .from('payment_notification_settings')
      .select(`
        id,
        company_id,
        active,
        companies!inner(id, name, is_active)
      `)
      .eq('active', true)
      .eq('companies.is_active', true);

    if (settingsError) {
      console.error('Error fetching notification settings:', settingsError);
      throw settingsError;
    }

    diagnostics.companies_with_settings = companiesSettings?.length || 0;
    console.log(`Found ${diagnostics.companies_with_settings} companies with active notification settings`);

    // 2. For each company, check overdue payments and notifications
    for (const setting of companiesSettings || []) {
      const companyDiag = {
        company_id: setting.company_id,
        company_name: setting.companies.name,
        overdue_payments: 0,
        pending_notifications: 0,
        failed_notifications: 0,
        issues: [] as string[]
      };

      // Check overdue payments
      const today = new Date().toISOString().split('T')[0];
      const { data: overduePayments, error: paymentsError } = await supabase
        .from('payment_transactions')
        .select(`
          id,
          due_date,
          amount,
          status,
          clients(name, phone, email)
        `)
        .eq('company_id', setting.company_id)
        .in('status', ['pending', 'overdue'])
        .lte('due_date', today)
        .not('client_id', 'is', null);

      if (paymentsError) {
        console.error(`Error fetching overdue payments for company ${setting.company_id}:`, paymentsError);
        companyDiag.issues.push(`Error fetching payments: ${paymentsError.message}`);
      } else {
        companyDiag.overdue_payments = overduePayments?.length || 0;
        diagnostics.overdue_payments += companyDiag.overdue_payments;

        // Check if these payments have notifications
        for (const payment of overduePayments || []) {
          if (!payment.clients?.phone) {
            companyDiag.issues.push(`Payment ${payment.id} has no valid client phone`);
            continue;
          }

          const { data: notifications } = await supabase
            .from('payment_notifications')
            .select('id, status, event_type, scheduled_for, last_error')
            .eq('payment_id', payment.id);

          if (!notifications || notifications.length === 0) {
            companyDiag.issues.push(`Payment ${payment.id} (due: ${payment.due_date}) has no notifications`);
            
            // Try to create notifications for this payment
            try {
              console.log(`Creating notifications for overdue payment ${payment.id}`);
              const notificationResponse = await supabase.functions.invoke('billing-notifications', {
                body: {
                  trigger: 'payment_created',
                  payment_id: payment.id
                }
              });
              
              if (notificationResponse.error) {
                companyDiag.issues.push(`Failed to create notifications for payment ${payment.id}: ${notificationResponse.error.message}`);
              } else {
                diagnostics.actions_taken.push(`Created notifications for payment ${payment.id}`);
              }
            } catch (error) {
              companyDiag.issues.push(`Error creating notifications for payment ${payment.id}: ${error.message}`);
            }
          } else {
            const pendingCount = notifications.filter(n => n.status === 'pending').length;
            const failedCount = notifications.filter(n => n.status === 'failed').length;
            
            companyDiag.pending_notifications += pendingCount;
            companyDiag.failed_notifications += failedCount;
            
            diagnostics.pending_notifications += pendingCount;
            diagnostics.failed_notifications += failedCount;
          }
        }
      }

      // Check WhatsApp integration status
      const { data: whatsappSettings } = await supabase
        .from('whatsapp_settings')
        .select('connection_status, is_active')
        .eq('company_id', setting.company_id)
        .eq('is_active', true)
        .single();

      if (!whatsappSettings) {
        companyDiag.issues.push('No active WhatsApp integration found');
      } else if (whatsappSettings.connection_status !== 'connected') {
        companyDiag.issues.push(`WhatsApp status: ${whatsappSettings.connection_status}`);
      }

      diagnostics.companies.push(companyDiag);
    }

    // 3. Try to process pending notifications
    try {
      console.log('Processing all pending notifications...');
      const notificationResponse = await supabase.functions.invoke('billing-notifications', {
        body: {
          trigger: 'manual_diagnostics',
          force: true
        }
      });
      
      if (notificationResponse.error) {
        diagnostics.actions_taken.push(`Failed to process notifications: ${notificationResponse.error.message}`);
      } else {
        diagnostics.actions_taken.push('Triggered manual notification processing');
      }
    } catch (error) {
      diagnostics.actions_taken.push(`Error processing notifications: ${error.message}`);
    }

    console.log('Billing diagnostics completed:', diagnostics);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Billing diagnostics completed',
        diagnostics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in billing diagnostics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});