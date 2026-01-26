-- Corrigir URLs de checkout com barra dupla
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/'),
    updated_at = now()
WHERE payment_url LIKE '%//checkout/%';