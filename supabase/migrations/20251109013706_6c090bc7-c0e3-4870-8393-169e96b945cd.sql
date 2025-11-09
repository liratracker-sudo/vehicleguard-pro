-- Modificar tabela ai_weekly_reports para suportar múltiplos telefones
ALTER TABLE ai_weekly_reports 
DROP COLUMN manager_phone;

ALTER TABLE ai_weekly_reports 
ADD COLUMN manager_phones text[] DEFAULT '{}';

COMMENT ON COLUMN ai_weekly_reports.manager_phones IS 'Array de telefones dos gestores que receberão relatórios';