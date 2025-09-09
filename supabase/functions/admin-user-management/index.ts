import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log(`Admin User Management - ${req.method} ${req.url}`)
  
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

    // Check if user is super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      console.error('User is not super admin:', profile)
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const body = await req.json()
    const action = body.action

    if (req.method === 'POST' && action === 'create_user') {
      console.log('Creating user:', body.email)

      // Create user with admin client (bypasses email confirmation)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true, // Auto-confirm email so user can login immediately
        user_metadata: {
          full_name: body.full_name
        }
      })

      if (createError) {
        console.error('Failed to create user:', createError)
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('User created in auth:', newUser.user.id, 'email_confirmed_at:', newUser.user.email_confirmed_at)

      // Create profile for the user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: newUser.user.id,
          email: body.email,
          full_name: body.full_name,
          company_id: body.company_id,
          role: body.role || 'admin'
        })

      if (profileError) {
        console.error('Failed to create profile:', profileError)
        // Cleanup: delete the created user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return new Response(
          JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('Profile created successfully for user:', newUser.user.id)
      
      // Verify user was created correctly
      const { data: verifyUser, error: verifyError } = await supabaseAdmin.auth.admin.getUserById(newUser.user.id)
      if (verifyError) {
        console.error('Failed to verify user creation:', verifyError)
      } else {
        console.log('User verification successful:', {
          id: verifyUser.user.id,
          email: verifyUser.user.email,
          email_confirmed_at: verifyUser.user.email_confirmed_at,
          created_at: verifyUser.user.created_at
        })
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Usuário criado com sucesso! Email confirmado automaticamente - pode fazer login imediatamente.',
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            email_confirmed: !!newUser.user.email_confirmed_at
          }
        }),
        { headers: corsHeaders }
      )
    }

    if (req.method === 'POST' && action === 'reset_password') {
      console.log('Resetting password for user:', body.user_id)

      // Update user password with admin client (immediate effect)
      const { data: updatedUser, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        body.user_id,
        { 
          password: body.new_password,
          email_confirm: true // Ensure email is confirmed
        }
      )

      if (resetError) {
        console.error('Failed to reset password:', resetError)
        return new Response(
          JSON.stringify({ error: `Failed to reset password: ${resetError.message}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('Password reset successfully for user:', body.user_id)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Senha resetada com sucesso! O usuário pode fazer login imediatamente.'
        }),
        { headers: corsHeaders }
      )
    }

    if (req.method === 'POST' && action === 'update_user_role') {
      console.log('Updating user role:', body.user_id, body.role)

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: body.role })
        .eq('user_id', body.user_id)

      if (updateError) {
        console.error('Failed to update user role:', updateError)
        return new Response(
          JSON.stringify({ error: `Failed to update user role: ${updateError.message}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('User role updated successfully')
      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      )
    }

    if (req.method === 'POST' && action === 'delete_user') {
      const userId = body.user_id
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID required' }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('Deleting user:', userId)

      // Delete user with admin client
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteError) {
        console.error('Failed to delete user:', deleteError)
        return new Response(
          JSON.stringify({ error: `Failed to delete user: ${deleteError.message}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log('User deleted successfully')
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
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    )
  }
})