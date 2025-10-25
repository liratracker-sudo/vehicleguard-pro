-- Adicionar colunas relacionadas ao webhook na tabela asaas_settings
ALTER TABLE public.asaas_settings
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS webhook_last_setup_at TIMESTAMP WITH TIME ZONE;