-- Verificar se o cron job weekly-reports-automation já existe
SELECT 
    jobname,
    schedule,
    command,
    active,
    jobid
FROM cron.job 
WHERE jobname = 'weekly-reports-automation';