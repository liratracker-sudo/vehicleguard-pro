-- Fix double slashes in existing payment URLs
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, '//checkout/', '/checkout/'),
    updated_at = now()
WHERE payment_url LIKE '%//checkout/%';