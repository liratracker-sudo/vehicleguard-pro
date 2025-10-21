-- Add webhook configuration fields to asaas_settings
ALTER TABLE public.asaas_settings
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_auth_token TEXT,
ADD COLUMN IF NOT EXISTS webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_events TEXT[],
ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT true;

-- Ensure fast lookup and uniqueness of webhook auth tokens
CREATE UNIQUE INDEX IF NOT EXISTS asaas_settings_webhook_auth_token_uidx
ON public.asaas_settings (webhook_auth_token)
WHERE webhook_auth_token IS NOT NULL;

-- Optional: record last webhook sync time
ALTER TABLE public.asaas_settings
ADD COLUMN IF NOT EXISTS webhook_last_setup_at TIMESTAMP WITH TIME ZONE;
