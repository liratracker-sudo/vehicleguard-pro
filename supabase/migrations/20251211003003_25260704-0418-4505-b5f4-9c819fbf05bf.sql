-- Atualizar Profissional - substituir a feature antiga pela nova
UPDATE subscription_plans 
SET features = (
  SELECT jsonb_agg(
    CASE 
      WHEN value::text = '"📊 Relatórios WhatsApp para Gestor"' THEN '"📊 Gerentes de Contas Virtual via WhatsApp para o Gestor"'::jsonb
      ELSE value
    END
  )
  FROM jsonb_array_elements(features) AS value
)
WHERE id = '06450ec0-d551-4737-932b-0602d033ac1e';

-- Atualizar Enterprise - substituir a feature antiga pela nova
UPDATE subscription_plans 
SET features = (
  SELECT jsonb_agg(
    CASE 
      WHEN value::text = '"📊 Relatórios WhatsApp para Gestor"' THEN '"📊 Gerentes de Contas Virtual via WhatsApp para o Gestor"'::jsonb
      ELSE value
    END
  )
  FROM jsonb_array_elements(features) AS value
)
WHERE id = '5452009d-9ce5-463c-a985-9843b18ba3f1';

-- Atualizar Empresarial - substituir variação diferente pela nova
UPDATE subscription_plans 
SET features = (
  SELECT jsonb_agg(
    CASE 
      WHEN value::text = '"📊 Gerentes de Contas Virtual WhatsApp para Gestor"' THEN '"📊 Gerentes de Contas Virtual via WhatsApp para o Gestor"'::jsonb
      ELSE value
    END
  )
  FROM jsonb_array_elements(features) AS value
)
WHERE id = '0f93bd25-5d00-44de-8e79-7c2bc312c388';