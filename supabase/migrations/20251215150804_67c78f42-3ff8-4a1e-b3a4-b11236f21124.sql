-- Adicionar coluna response_data na tabela whatsapp_logs para armazenar resposta completa da Evolution API
ALTER TABLE public.whatsapp_logs 
ADD COLUMN IF NOT EXISTS response_data JSONB;