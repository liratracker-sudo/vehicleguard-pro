-- Adicionar campos anti-spam na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS whatsapp_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_block_reason TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_failures INTEGER DEFAULT 0;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_opt_out ON public.clients(whatsapp_opt_out) WHERE whatsapp_opt_out = true;
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_blocked ON public.clients(whatsapp_blocked) WHERE whatsapp_blocked = true;