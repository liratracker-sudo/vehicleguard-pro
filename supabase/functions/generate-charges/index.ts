import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appUrl = Deno.env.get('APP_URL') || 'https://vehicleguard-pro.lovable.app';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting automatic charge generation...');
    
    // Get all active companies with subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('company_subscriptions')
      .select(`
        *,
        companies!inner(id, name, is_active),
        subscription_plans!inner(id, name, price_monthly, price_yearly)
      `)
      .eq('status', 'active')
      .eq('companies.is_active', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} active subscriptions to process`);

    const results = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (const subscription of subscriptions || []) {
      try {
        // Check if charge already exists for this month/year
        const { data: existingCharges } = await supabase
          .from('payment_transactions')
          .select('id')
          .eq('company_id', subscription.company_id)
          .eq('transaction_type', 'subscription')
          .gte('created_at', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          .lt('created_at', `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`);

        if (existingCharges && existingCharges.length > 0) {
          console.log(`Charge already exists for company ${subscription.company_id} this month`);
          continue;
        }

        // Calculate amount based on billing cycle
        const plan = subscription.subscription_plans;
        const amount = plan.price_monthly; // For now, always monthly
        
        // Set due date (always 15 days from today to ensure future date)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 15);

        // Get or create a system client for the company
        let systemClient;
        const { data: existingSystemClient } = await supabase
          .from('clients')
          .select('id')
          .eq('company_id', subscription.company_id)
          .eq('name', 'Sistema - Cobrança Automática')
          .single();

        if (existingSystemClient) {
          systemClient = existingSystemClient;
        } else {
          // Create system client for automatic charges
          const { data: company } = await supabase
            .from('companies')
            .select('name, email, phone')
            .eq('id', subscription.company_id)
            .single();

          const { data: newSystemClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              company_id: subscription.company_id,
              name: 'Sistema - Cobrança Automática',
              email: company?.email || 'sistema@empresa.com',
              phone: company?.phone || '11999999999',
              document: 'SISTEMA',
              status: 'active'
            })
            .select('id')
            .single();

          if (clientError) {
            console.error(`Error creating system client for company ${subscription.company_id}:`, clientError);
            continue;
          }
          systemClient = newSystemClient;
        }

        // Create charge in payment_transactions (without gateway yet)
        const { data: charge, error: chargeError } = await supabase
          .from('payment_transactions')
          .insert({
            company_id: subscription.company_id,
            client_id: systemClient.id, // Use system client
            transaction_type: 'subscription',
            amount: amount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            payment_gateway: null // Will be determined by payment_gateway_methods config
          })
          .select()
          .single();

        if (chargeError) {
          console.error(`Error creating charge for company ${subscription.company_id}:`, chargeError);
          continue;
        }

        console.log(`Created charge ${charge.id} for company ${subscription.companies.name}`);

        // Set payment URL to checkout page (universal link) - gateway integration happens when client chooses payment method
        const checkoutUrl = `${appUrl}/checkout/${charge.id}`;
        
        await supabase
          .from('payment_transactions')
          .update({
            payment_url: checkoutUrl
          })
          .eq('id', charge.id);

        console.log(`Created charge ${charge.id} with checkout URL: ${checkoutUrl}`);

        results.push({
          company_id: subscription.company_id,
          company_name: subscription.companies.name,
          charge_id: charge.id,
          amount: amount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'created'
        });

      } catch (error) {
        console.error(`Error processing subscription for company ${subscription.company_id}:`, error);
        results.push({
          company_id: subscription.company_id,
          company_name: subscription.companies?.name || 'Unknown',
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`Charge generation completed. Processed ${results.length} subscriptions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${results.filter(r => r.status === 'created').length} charges`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-charges function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});