-- Fase 2: Corrigir URLs com domínio antigo
UPDATE payment_transactions 
SET payment_url = REPLACE(
  payment_url, 
  'gestaotracker.lovable.app', 
  'vehicleguard-pro.lovable.app'
),
updated_at = NOW()
WHERE payment_url LIKE '%gestaotracker.lovable.app%'
AND status IN ('pending', 'overdue');

-- Fase 3: Corrigir URLs relativas (sem domínio)
UPDATE payment_transactions 
SET payment_url = CONCAT(
  'https://vehicleguard-pro.lovable.app', 
  payment_url
),
updated_at = NOW()
WHERE payment_url LIKE '/checkout/%'
AND status IN ('pending', 'overdue');