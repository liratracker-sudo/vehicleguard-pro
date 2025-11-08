-- Habilitar realtime para payment_transactions
ALTER TABLE payment_transactions REPLICA IDENTITY FULL;

-- A tabela já deve estar na publicação supabase_realtime
-- Mas vamos garantir que está
ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;