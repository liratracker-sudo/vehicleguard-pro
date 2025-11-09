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
    console.log('Starting payment URLs update to checkout format...');

    // Get all payment transactions that have gateway URLs
    const { data: payments, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('id, payment_url')
      .not('payment_url', 'is', null)
      .in('status', ['pending', 'overdue']);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${payments?.length || 0} payments with URLs`);

    let updated = 0;
    let skipped = 0;

    for (const payment of payments || []) {
      // Check if URL is already a payment URL with public domain
      if (payment.payment_url?.includes('/payment/') || payment.payment_url?.includes('/checkout/')) {
        skipped++;
        continue;
      }

      // Check if it's a gateway URL (asaas.com, mercadopago, etc)
      const isGatewayUrl = 
        payment.payment_url?.includes('asaas.com') ||
        payment.payment_url?.includes('mercadopago') ||
        payment.payment_url?.includes('gerencianet') ||
        payment.payment_url?.includes('bancointer');

      if (isGatewayUrl) {
        // Update to checkout URL with public domain
        const checkoutUrl = `${appUrl}/checkout/${payment.id}`;
        
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            payment_url: checkoutUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateError) {
          console.error(`Error updating payment ${payment.id}:`, updateError);
        } else {
          updated++;
          console.log(`Updated payment ${payment.id} to checkout URL`);
        }
      } else {
        skipped++;
      }
    }

    console.log(`Update completed: ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        total: payments?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating payment URLs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
