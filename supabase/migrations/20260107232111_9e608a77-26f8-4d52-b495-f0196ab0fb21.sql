-- Gerar recorrências retroativas das despesas pagas em dezembro/2025
INSERT INTO expenses (
  company_id,
  description,
  amount,
  due_date,
  status,
  category_id,
  supplier_name,
  notes,
  recurrence_type,
  recurrence_parent_id
)
SELECT 
  company_id,
  description,
  amount,
  (due_date + INTERVAL '1 month')::date as due_date,
  'pending' as status,
  category_id,
  supplier_name,
  notes,
  recurrence_type,
  id as recurrence_parent_id
FROM expenses
WHERE id IN (
  '80bdf809-f5db-4282-8294-1bc33bb23d30',
  '696f38ea-f3ef-4790-85c7-f4e6f14a6a60',
  '5bb5762c-aa21-4b61-b276-5294fe661487'
)
AND status = 'paid'
AND recurrence_type = 'monthly';