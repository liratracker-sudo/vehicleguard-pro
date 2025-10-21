-- Middleware para validação de sessão WhatsApp antes de enviar mensagens
CREATE OR REPLACE FUNCTION public.validate_whatsapp_session(p_company_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  session_status TEXT,
  instance_name TEXT,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Buscar sessão ativa da empresa
  SELECT ws.status, ws.instance_name, ws.expires_at, ws.updated_at
  INTO session_record
  FROM whatsapp_sessions ws
  WHERE ws.company_id = p_company_id
  ORDER BY ws.updated_at DESC
  LIMIT 1;

  -- Se não encontrou sessão
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, ''::TEXT, 'Nenhuma sessão WhatsApp encontrada. Configure a integração primeiro.'::TEXT;
    RETURN;
  END IF;

  -- Se sessão expirou (mais de 24 horas sem atualização)
  IF session_record.updated_at < NOW() - INTERVAL '24 hours' THEN
    -- Atualizar status para expirada
    UPDATE whatsapp_sessions 
    SET status = 'expired' 
    WHERE company_id = p_company_id AND instance_name = session_record.instance_name;
    
    RETURN QUERY SELECT FALSE, 'expired'::TEXT, session_record.instance_name, 'Sessão WhatsApp expirada. Reconecte para continuar enviando mensagens.'::TEXT;
    RETURN;
  END IF;

  -- Se sessão não está conectada
  IF session_record.status != 'connected' THEN
    RETURN QUERY SELECT FALSE, session_record.status, session_record.instance_name, 
      CASE 
        WHEN session_record.status = 'connecting' THEN 'Sessão WhatsApp conectando. Aguarde alguns instantes.'
        WHEN session_record.status = 'disconnected' THEN 'Sessão WhatsApp desconectada. Reconecte para enviar mensagens.'
        ELSE 'Sessão WhatsApp em estado: ' || session_record.status
      END;
    RETURN;
  END IF;

  -- Sessão válida
  RETURN QUERY SELECT TRUE, session_record.status, session_record.instance_name, 'Sessão WhatsApp ativa e válida.'::TEXT;
END;
$$;