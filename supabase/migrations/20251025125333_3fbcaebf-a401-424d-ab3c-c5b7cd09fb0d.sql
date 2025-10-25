-- Adicionar coluna webhook_auth_token à tabela asaas_settings
ALTER TABLE public.asaas_settings
ADD COLUMN IF NOT EXISTS webhook_auth_token TEXT;