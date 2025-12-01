-- Sincronizar logo_url existentes de company_branding para companies
UPDATE companies c
SET logo_url = cb.logo_url
FROM company_branding cb
WHERE c.id = cb.company_id 
  AND cb.logo_url IS NOT NULL
  AND (c.logo_url IS NULL OR c.logo_url = '');