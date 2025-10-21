-- Criar tabela para persistência de sessões WhatsApp
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  instance_name TEXT NOT NULL,
  qr_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(company_id, instance_name)
);

-- Habilitar RLS na tabela
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Criar política para membros da empresa
CREATE POLICY "Company members can access sessions" 
ON public.whatsapp_sessions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = whatsapp_sessions.company_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();