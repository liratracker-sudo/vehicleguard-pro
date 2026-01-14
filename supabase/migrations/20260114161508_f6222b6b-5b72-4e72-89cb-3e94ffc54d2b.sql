-- Corrigir pagamento do cliente Walisson que foi sobrescrito incorretamente
UPDATE payment_transactions 
SET status = 'paid', 
    updated_at = NOW()
WHERE id = 'f73da955-c24b-47f4-9c0b-032a9994c158';