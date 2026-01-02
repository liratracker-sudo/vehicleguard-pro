import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // GET /cron-management - List all cron jobs
    if (req.method === 'GET' && path === 'cron-management') {
      console.log('Listando cron jobs...')
      
      const { data: jobs, error: jobsError } = await supabase.rpc('get_cron_jobs')
      
      if (jobsError) {
        console.error('Erro ao buscar jobs:', jobsError)
        // Try direct query if RPC doesn't exist
        const { data: directJobs, error: directError } = await supabase
          .from('cron_execution_logs')
          .select('job_name')
          .order('started_at', { ascending: false })
          .limit(100)

        if (directError) {
          return new Response(JSON.stringify({ error: 'Erro ao buscar jobs', details: directError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get unique job names from logs
        const uniqueJobs = [...new Set(directJobs?.map(j => j.job_name) || [])]
        const jobsList = uniqueJobs.map(name => ({
          jobname: name,
          schedule: 'Verificar no banco',
          active: true
        }))

        return new Response(JSON.stringify({ jobs: jobsList }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ jobs: jobs || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /cron-management/history - Get execution history
    if (req.method === 'GET' && path === 'history') {
      const jobName = url.searchParams.get('jobName')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      console.log('Buscando histórico de execuções...', { jobName, limit })

      let query = supabase
        .from('cron_execution_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

      if (jobName) {
        query = query.eq('job_name', jobName)
      }

      const { data: history, error: historyError } = await query

      if (historyError) {
        console.error('Erro ao buscar histórico:', historyError)
        return new Response(JSON.stringify({ error: 'Erro ao buscar histórico', details: historyError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ history: history || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /cron-management - Create new cron job
    if (req.method === 'POST' && path === 'cron-management') {
      const body = await req.json()
      const { jobName, functionName, schedule, description } = body

      if (!jobName || !functionName || !schedule) {
        return new Response(JSON.stringify({ error: 'jobName, functionName e schedule são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Criando novo cron job:', { jobName, functionName, schedule })

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`

      // Create cron job using raw SQL
      const createJobSQL = `
        SELECT cron.schedule(
          '${jobName}',
          '${schedule}',
          $$
          SELECT net.http_post(
            url:='${functionUrl}',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
            body:=concat('{"time": "', now(), '", "source": "cron"}')::jsonb
          ) as request_id;
          $$
        );
      `

      const { error: createError } = await supabase.rpc('exec_sql', { sql: createJobSQL })

      if (createError) {
        console.error('Erro ao criar job:', createError)
        return new Response(JSON.stringify({ 
          error: 'Erro ao criar cron job', 
          details: createError.message,
          hint: 'Verifique se as extensões pg_cron e pg_net estão ativadas'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: `Job ${jobName} criado com sucesso` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /cron-management/run - Run job manually
    if (req.method === 'POST' && path === 'run') {
      const body = await req.json()
      const { functionName } = body

      if (!functionName) {
        return new Response(JSON.stringify({ error: 'functionName é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Executando função manualmente:', functionName)

      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { manual: true, source: 'cron-management' }
        })

        if (error) {
          console.error('Erro ao executar função:', error)
          return new Response(JSON.stringify({ error: 'Erro ao executar função', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, message: `Função ${functionName} executada`, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (invokeError) {
        console.error('Erro ao invocar função:', invokeError)
        return new Response(JSON.stringify({ error: 'Erro ao invocar função', details: String(invokeError) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // DELETE /cron-management - Delete cron job
    if (req.method === 'DELETE') {
      const body = await req.json()
      const { jobName } = body

      if (!jobName) {
        return new Response(JSON.stringify({ error: 'jobName é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Removendo cron job:', jobName)

      const { error: deleteError } = await supabase.rpc('exec_sql', { 
        sql: `SELECT cron.unschedule('${jobName}');` 
      })

      if (deleteError) {
        console.error('Erro ao remover job:', deleteError)
        return new Response(JSON.stringify({ error: 'Erro ao remover job', details: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: `Job ${jobName} removido` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
