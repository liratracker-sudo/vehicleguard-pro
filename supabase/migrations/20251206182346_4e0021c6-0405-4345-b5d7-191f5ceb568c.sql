-- Corrigir o domínio da empresa (remover https:// duplicado)
UPDATE companies 
SET domain = 'app.liratracker.com.br' 
WHERE id = '3f86782c-a67f-498c-8913-d001dcba7dcf';