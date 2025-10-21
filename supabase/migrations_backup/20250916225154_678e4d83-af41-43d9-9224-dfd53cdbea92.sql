-- Corrigir cron job atual e adicionar logs de execução
-- 1. Verificar e remover jobs antigos
SELECT cron.unschedule('billing-notifications-every-15-min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-notifications-every-15-min'
);

SELECT cron.unschedule('billing-notifications-job')  
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-notifications-job'
);

SELECT cron.unschedule('billing-notifications-optimized')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-notifications-optimized'
);

-- 2. Criar tabela de logs de execução do cron
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running', -- running, success, error
  response_body TEXT,
  error_message TEXT,
  execution_time_ms INTEGER
);

-- Enable RLS
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

-- Allow system to insert logs
CREATE POLICY "System can manage cron logs" ON public.cron_execution_logs
FOR ALL USING (true);

-- 3. Recriar o cron job com melhor configuração
SELECT cron.schedule(
  'billing-notifications-system',
  '*/3 * * * *', -- A cada 3 minutos para melhor responsividade
  $$
  -- Log início da execução
  INSERT INTO public.cron_execution_logs (job_name, status) VALUES ('billing-notifications-system', 'running');
  
  -- Executar função de notificações
  SELECT
    net.http_post(
        url:='https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body:='{"trigger": "cron", "timestamp": "' || extract(epoch from now()) || '"}'::jsonb
    ) as request_id;
  $$
);

-- 4. Criar função para limpeza de logs antigos (manter apenas 7 dias)
SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 2 * * *', -- Todo dia às 2h da manhã
  $$
  DELETE FROM public.cron_execution_logs 
  WHERE started_at < NOW() - INTERVAL '7 days';
  $$
);

-- 5. Atualizar notificações pendentes antigas para serem processadas novamente
UPDATE public.payment_notifications 
SET 
  status = 'pending',
  attempts = 0,
  last_error = NULL,
  scheduled_for = CASE 
    WHEN scheduled_for < NOW() - INTERVAL '1 hour' THEN NOW()
    ELSE scheduled_for
  END
WHERE status = 'failed' 
  AND scheduled_for > NOW() - INTERVAL '48 hours';