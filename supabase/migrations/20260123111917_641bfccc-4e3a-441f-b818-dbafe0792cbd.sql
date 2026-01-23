-- Corrigir URLs com barra dupla (//checkout/)
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/'),
    updated_at = NOW()
WHERE payment_url LIKE '%//checkout/%'
AND status IN ('pending', 'overdue');