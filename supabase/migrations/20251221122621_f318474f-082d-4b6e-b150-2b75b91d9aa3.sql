-- Marcar crons travados como failed
UPDATE cron_execution_logs 
SET status = 'failed', 
    finished_at = NOW(), 
    error_message = 'Execução travada - timeout detectado manualmente'
WHERE status = 'running' 
AND job_name LIKE 'billing-notifications%'
AND started_at < NOW() - INTERVAL '1 hour';