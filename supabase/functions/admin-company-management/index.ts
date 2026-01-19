import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignPlanRequest {
  company_id: string
  plan_id: string
  starts_at?: string
  ends_at?: string
}

interface UpdateCompanyLimitsRequest {
  company_id: string
  limits: {
    max_users?: number
    max_vehicles?: number
    max_messages_per_month?: number
    max_api_calls_per_day?: number
    max_storage_mb?: number
  }
}

Deno.serve(async (req) => {
  console.log(`Admin Company Management - ${req.method} ${req.url}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Initialize regular client for user verification
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Verify the user is authenticated and is super admin
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      console.error('User authentication failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check if user is super admin (verificar na tabela user_roles)
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!userRole) {
      console.error('User is not super admin. User ID:', user.id)
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: corsHeaders }
      )
    }
    
    console.log('Super admin verified:', user.id)

    const { method } = req
    const body = await req.json()
    const action = body.action

    if (method === 'POST' && action === 'assign_plan') {
      console.log('Assigning plan to company:', body.company_id, body.plan_id)

      // First, deactivate any existing active subscriptions
      const { error: deactivateError } = await supabaseAdmin
        .from('company_subscriptions')
        .update({ status: 'cancelled' })
        .eq('company_id', body.company_id)
        .eq('status', 'active')

      if (deactivateError) {
        console.error('Failed to deactivate existing subscriptions:', deactivateError)
      }

      // Create new subscription
      const subscriptionData: any = {
        company_id: body.company_id,
        plan_id: body.plan_id,
        status: 'active',
        started_at: body.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
        auto_renew: true
      }

      if (body.ends_at) {
        subscriptionData.ends_at = new Date(body.ends_at).toISOString()
      }

      const { error: subscriptionError } = await supabaseAdmin
        .from('company_subscriptions')
        .insert(subscriptionData)

      if (subscriptionError) {
        console.error('Failed to create subscription:', subscriptionError)
        return new Response(
          JSON.stringify({ error: subscriptionError.message }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Get plan limits and update company limits
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('id', body.plan_id)
        .single()

      if (plan) {
        // Update or create company limits based on plan
        const { error: limitsError } = await supabaseAdmin
          .from('company_limits')
          .upsert({
            company_id: body.company_id,
            max_users: plan.max_users,
            max_vehicles: plan.max_vehicles,
            max_messages_per_month: plan.max_messages_per_month,
            max_api_calls_per_day: plan.max_api_calls_per_day,
            max_storage_mb: plan.max_storage_mb,
            is_active: true
          })

        if (limitsError) {
          console.error('Failed to update company limits:', limitsError)
        }
      }

      console.log('Plan assigned successfully to company')
      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      )
    }

    if (method === 'POST' && action === 'update_limits') {
      console.log('Updating company limits:', body.company_id)

      const { error: limitsError } = await supabaseAdmin
        .from('company_limits')
        .upsert({
          company_id: body.company_id,
          ...body.limits,
          updated_at: new Date().toISOString()
        })

      if (limitsError) {
        console.error('Failed to update company limits:', limitsError)
        return new Response(
          JSON.stringify({ error: limitsError.message }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('Company limits updated successfully')
      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      )
    }

    if (method === 'POST' && action === 'toggle_company_status') {
      console.log('Toggling company status:', body.company_id, body.is_active)

      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ is_active: body.is_active })
        .eq('id', body.company_id)

      if (updateError) {
        console.error('Failed to update company status:', updateError)
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: corsHeaders }
        )
      }

      // Also update company limits status
      await supabaseAdmin
        .from('company_limits')
        .update({ is_active: body.is_active })
        .eq('company_id', body.company_id)

      console.log('Company status updated successfully')
      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      )
    }

    if (method === 'POST' && action === 'delete_company') {
      console.log('Deleting company:', body.company_id)

      // Check for linked data
      const [clients, vehicles, payments] = await Promise.all([
        supabaseAdmin.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id),
        supabaseAdmin.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id),
        supabaseAdmin.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('company_id', body.company_id)
      ])

      const clientCount = clients.count || 0
      const vehicleCount = vehicles.count || 0
      const paymentCount = payments.count || 0

      // If force_delete is not true and there's linked data, return error with counts
      if (!body.force_delete && (clientCount > 0 || vehicleCount > 0 || paymentCount > 0)) {
        console.log('Company has linked data:', { clientCount, vehicleCount, paymentCount })
        return new Response(
          JSON.stringify({ 
            error: 'has_linked_data',
            data: {
              clients: clientCount,
              vehicles: vehicleCount,
              payments: paymentCount
            }
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      console.log('Proceeding with cascaded deletion...')

      // Delete in order to respect foreign keys
      // 1. Payment notification logs
      await supabaseAdmin.from('payment_notification_logs').delete().eq('company_id', body.company_id)
      
      // 2. Payment transactions
      await supabaseAdmin.from('payment_transactions').delete().eq('company_id', body.company_id)
      
      // 3. Contract vehicles (need to get contract ids first)
      const { data: contracts } = await supabaseAdmin.from('contracts').select('id').eq('company_id', body.company_id)
      if (contracts && contracts.length > 0) {
        const contractIds = contracts.map(c => c.id)
        await supabaseAdmin.from('contract_vehicles').delete().in('contract_id', contractIds)
      }
      
      // 4. Contracts
      await supabaseAdmin.from('contracts').delete().eq('company_id', body.company_id)
      
      // 5. Vehicles
      await supabaseAdmin.from('vehicles').delete().eq('company_id', body.company_id)
      
      // 6. Client registrations vehicles
      const { data: registrations } = await supabaseAdmin.from('client_registrations').select('id').eq('company_id', body.company_id)
      if (registrations && registrations.length > 0) {
        const regIds = registrations.map(r => r.id)
        await supabaseAdmin.from('client_registration_vehicles').delete().in('registration_id', regIds)
      }
      
      // 7. Client registrations
      await supabaseAdmin.from('client_registrations').delete().eq('company_id', body.company_id)
      
      // 8. Client scores
      await supabaseAdmin.from('client_scores').delete().eq('company_id', body.company_id)
      
      // 9. Client escalation history
      await supabaseAdmin.from('client_escalation_history').delete().eq('company_id', body.company_id)
      
      // 10. Clients
      await supabaseAdmin.from('clients').delete().eq('company_id', body.company_id)
      
      // 11. Expenses
      await supabaseAdmin.from('expenses').delete().eq('company_id', body.company_id)
      
      // 12. Expense categories
      await supabaseAdmin.from('expense_categories').delete().eq('company_id', body.company_id)
      
      // 13. Expense notification settings/logs
      await supabaseAdmin.from('expense_notification_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('expense_notification_settings').delete().eq('company_id', body.company_id)
      
      // 14. Payment notification settings
      await supabaseAdmin.from('payment_notification_settings').delete().eq('company_id', body.company_id)
      
      // 15. Contract templates
      await supabaseAdmin.from('contract_templates').delete().eq('company_id', body.company_id)
      
      // 16. Bank accounts
      await supabaseAdmin.from('bank_accounts').delete().eq('company_id', body.company_id)
      
      // 17. Integration settings
      await supabaseAdmin.from('asaas_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('asaas_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('assinafy_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('assinafy_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('gerencianet_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('gerencianet_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('inter_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('inter_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('mercadopago_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('mercadopago_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('whatsapp_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('whatsapp_logs').delete().eq('company_id', body.company_id)
      
      // 18. AI settings and logs
      await supabaseAdmin.from('ai_collection_settings').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('ai_collection_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('ai_weekly_reports').delete().eq('company_id', body.company_id)
      
      // 19. Company API keys and usage logs
      await supabaseAdmin.from('api_usage_logs').delete().eq('company_id', body.company_id)
      await supabaseAdmin.from('company_api_keys').delete().eq('company_id', body.company_id)
      
      // 20. Company activity logs
      await supabaseAdmin.from('company_activity_logs').delete().eq('company_id', body.company_id)
      
      // 21. Admin notification logs
      await supabaseAdmin.from('admin_notification_logs').delete().eq('company_id', body.company_id)
      
      // 22. Company branding
      await supabaseAdmin.from('company_branding').delete().eq('company_id', body.company_id)
      
      // 23. Company credentials
      await supabaseAdmin.from('company_credentials').delete().eq('company_id', body.company_id)
      
      // 24. Company late fee settings
      await supabaseAdmin.from('company_late_fee_settings').delete().eq('company_id', body.company_id)
      
      // 25. Company limits
      await supabaseAdmin.from('company_limits').delete().eq('company_id', body.company_id)
      
      // 26. Company subscriptions
      await supabaseAdmin.from('company_subscriptions').delete().eq('company_id', body.company_id)
      
      // 27. Profiles (users)
      await supabaseAdmin.from('profiles').delete().eq('company_id', body.company_id)
      
      // 28. Finally, delete the company
      const { error: deleteError } = await supabaseAdmin
        .from('companies')
        .delete()
        .eq('id', body.company_id)

      if (deleteError) {
        console.error('Failed to delete company:', deleteError)
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('Company deleted successfully:', body.company_id)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})