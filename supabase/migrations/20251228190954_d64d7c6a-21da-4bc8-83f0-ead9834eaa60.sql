-- Corrigir domínio da empresa LIRA TRACKER
UPDATE companies 
SET domain = 'https://app.liratracker.com.br' 
WHERE id = '3f86782c-a67f-498c-8913-d001dcba7dcf';

-- Corrigir URLs de pagamento malformadas
UPDATE payment_transactions 
SET payment_url = REPLACE(payment_url, 'https://https:://', 'https://')
WHERE payment_url LIKE '%https://https:://%';

-- Também corrigir variações com mais colons ou barras
UPDATE payment_transactions 
SET payment_url = REGEXP_REPLACE(payment_url, 'https?:+/+', 'https://', 'gi')
WHERE payment_url ~ 'https?:+/+' AND payment_url NOT LIKE 'https://%';