-- Alterar coluna manager_phone para manager_phones (array) na tabela ai_weekly_reports
ALTER TABLE ai_weekly_reports 
DROP COLUMN IF EXISTS manager_phone;

ALTER TABLE ai_weekly_reports 
ADD COLUMN manager_phones text[] DEFAULT '{}';

COMMENT ON COLUMN ai_weekly_reports.manager_phones IS 'Array de até 6 números de telefone dos gestores para receber relatórios e interagir com o assistente de IA';