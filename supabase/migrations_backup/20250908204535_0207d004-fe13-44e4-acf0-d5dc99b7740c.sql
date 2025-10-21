-- Corrigir constraint único para evitar duplicatas na tabela whatsapp_settings
-- E adicionar função para manter apenas uma configuração ativa por empresa

-- Primeiro, limpar registros duplicados mantendo apenas o mais recente por empresa
WITH ranked_settings AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at DESC) as rn
  FROM whatsapp_settings
)
DELETE FROM whatsapp_settings 
WHERE id IN (
  SELECT id FROM ranked_settings WHERE rn > 1
);

-- Adicionar constraint único para evitar futuras duplicatas
ALTER TABLE whatsapp_settings 
ADD CONSTRAINT unique_company_settings 
UNIQUE (company_id);

-- Função para manter conexão ativa e reconectar automaticamente
CREATE OR REPLACE FUNCTION public.maintain_whatsapp_connection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expired_sessions CURSOR FOR 
    SELECT ws.*, wss.instance_name as settings_instance_name, wss.api_token
    FROM whatsapp_sessions ws
    JOIN whatsapp_settings wss ON ws.company_id = wss.company_id
    WHERE ws.updated_at < NOW() - INTERVAL '5 minutes'
    AND ws.status = 'connected'
    AND wss.is_active = true;
    
  session_record RECORD;
BEGIN
  -- Marcar sessões antigas como expiradas e tentar reconectar
  FOR session_record IN expired_sessions LOOP
    -- Atualizar status para reconectando
    UPDATE whatsapp_sessions 
    SET status = 'reconnecting', updated_at = NOW()
    WHERE id = session_record.id;
    
    -- Log da tentativa de reconexão
    INSERT INTO whatsapp_logs (
      company_id, 
      phone_number, 
      message_type, 
      message_content, 
      status
    ) VALUES (
      session_record.company_id,
      'system',
      'system',
      'Tentando reconectar sessão: ' || session_record.instance_name,
      'sent'
    );
  END LOOP;
END;
$$;

-- Criar trigger para manter updated_at atualizado automaticamente
CREATE OR REPLACE FUNCTION public.update_whatsapp_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplicar trigger na tabela whatsapp_sessions
DROP TRIGGER IF EXISTS update_whatsapp_sessions_timestamp ON whatsapp_sessions;
CREATE TRIGGER update_whatsapp_sessions_timestamp
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_session_timestamp();