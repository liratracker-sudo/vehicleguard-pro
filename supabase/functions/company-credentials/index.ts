import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    // Verificar se é super_admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      throw new Error('Access denied: Super admin required')
    }

    const { action, companyId, password } = await req.json()

    switch (action) {
      case 'create': {
        if (!companyId || !password) {
          throw new Error('Company ID and password are required')
        }

        // Hash da senha usando Web Crypto API
        const encoder = new TextEncoder()
        const data = encoder.encode(password)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        const { error } = await supabaseClient
          .from('company_credentials')
          .insert([{
            company_id: companyId,
            password_hash: passwordHash
          }])

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Senha criada com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        if (!companyId || !password) {
          throw new Error('Company ID and password are required')
        }

        // Hash da nova senha
        const encoder = new TextEncoder()
        const data = encoder.encode(password)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        const { error } = await supabaseClient
          .from('company_credentials')
          .update({ password_hash: passwordHash })
          .eq('company_id', companyId)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Senha atualizada com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        if (!companyId) {
          throw new Error('Company ID is required')
        }

        const { error } = await supabaseClient
          .from('company_credentials')
          .delete()
          .eq('company_id', companyId)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Credenciais removidas com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Company credentials error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})