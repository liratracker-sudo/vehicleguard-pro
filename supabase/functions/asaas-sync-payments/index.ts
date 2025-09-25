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

const ASAAS_API_BASE = "https://api.asaas.com/v3";
const ASAAS_SANDBOX_BASE = "https://api-sandbox.asaas.com/v3";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Asaas payment sync job...');

    // Get all active companies with Asaas settings
    const { data: companies } = await supabase
      .from('asaas_settings')
      .select(`
        company_id,
        api_token_encrypted,
        is_sandbox,
        companies (
          name,
          is_active
        )
      `)
      .eq('is_active', true);

    if (!companies || companies.length === 0) {
      console.log('No active Asaas integrations found');
      return new Response(
        JSON.stringify({ message: 'No active integrations to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;
    let totalErrors = 0;

    for (const company of companies) {
      try {
        console.log(`Syncing payments for company: ${company.company_id}`);
        
        // Get pending/overdue payments for this company
        const { data: pendingPayments } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('company_id', company.company_id)
          .in('status', ['pending', 'overdue'])
          .not('external_id', 'is', null);

        if (!pendingPayments || pendingPayments.length === 0) {
          console.log(`No pending payments to sync for company: ${company.company_id}`);
          continue;
        }

        // Decrypt API token
        const { data: decryptedToken } = await supabase.rpc('decrypt_asaas_token', {
          p_encrypted_token: company.api_token_encrypted
        });

        if (!decryptedToken) {
          console.error(`Failed to decrypt API token for company: ${company.company_id}`);
          totalErrors++;
          continue;
        }

        const baseUrl = company.is_sandbox ? ASAAS_SANDBOX_BASE : ASAAS_API_BASE;
        
        // Sync each payment
        for (const payment of pendingPayments) {
          try {
            console.log(`Checking payment ${payment.external_id} status...`);
            
            const response = await fetch(`${baseUrl}/payments/${payment.external_id}`, {
              headers: {
                'access_token': decryptedToken,
                'access-token': decryptedToken,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) {
              console.error(`Failed to fetch payment ${payment.external_id}: ${response.status}`);
              continue;
            }

            const asaasPayment = await response.json();
            
            // Map Asaas status to our status
            let newStatus = payment.status;
            let paidAt = payment.paid_at;

            switch (asaasPayment.status) {
              case 'RECEIVED':
              case 'CONFIRMED':
                newStatus = 'paid';
                paidAt = asaasPayment.confirmedDate || asaasPayment.paymentDate || new Date().toISOString();
                break;
              
              case 'OVERDUE':
                newStatus = 'overdue';
                break;
              
              case 'REFUNDED':
              case 'RECEIVED_IN_CASH_UNDONE':
                newStatus = 'cancelled';
                break;
              
              case 'PENDING':
              case 'AWAITING_PAYMENT':
                newStatus = 'pending';
                break;
            }

            // Update status if changed
            if (newStatus !== payment.status) {
              const { error: updateError } = await supabase
                .from('payment_transactions')
                .update({
                  status: newStatus,
                  paid_at: paidAt,
                  updated_at: new Date().toISOString()
                })
                .eq('id', payment.id);

              if (updateError) {
                console.error(`Error updating payment ${payment.id}:`, updateError);
                totalErrors++;
              } else {
                console.log(`Updated payment ${payment.id} status from ${payment.status} to ${newStatus}`);
                totalSynced++;

                // Log the sync operation
                await supabase.from('asaas_logs').insert({
                  company_id: company.company_id,
                  operation_type: 'sync',
                  status: 'success',
                  request_data: { payment_id: payment.external_id },
                  response_data: { 
                    old_status: payment.status, 
                    new_status: newStatus,
                    asaas_status: asaasPayment.status
                  }
                });
              }
            }

          } catch (paymentError) {
            console.error(`Error syncing payment ${payment.external_id}:`, paymentError);
            totalErrors++;
          }
        }

      } catch (companyError) {
        console.error(`Error syncing company ${company.company_id}:`, companyError);
        totalErrors++;
      }
    }

    console.log(`Sync completed. Updated: ${totalSynced}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payment sync completed',
        synced: totalSynced,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in Asaas sync job:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});