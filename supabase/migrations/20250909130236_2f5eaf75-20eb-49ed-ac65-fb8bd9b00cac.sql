-- Adicionar foreign key constraint entre payment_transactions e clients
ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;