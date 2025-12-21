-- Corrigir valor do pagamento do Rodrigo que estava inconsistente
UPDATE payment_transactions 
SET 
  amount = 227.57,
  original_amount = 224.50,
  fine_amount = 3.00,
  interest_amount = 0.07,
  days_overdue = 1
WHERE id = '6c83b089-4e0c-4e60-96a1-daf17a7f33ca';