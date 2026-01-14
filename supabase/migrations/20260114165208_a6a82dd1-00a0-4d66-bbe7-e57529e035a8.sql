-- Adicionar campo protested_at na tabela payment_transactions
ALTER TABLE payment_transactions 
ADD COLUMN protested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índice para performance em queries de filtro
CREATE INDEX idx_payment_protested ON payment_transactions(protested_at) 
WHERE protested_at IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN payment_transactions.protested_at IS 
'Data em que a cobrança foi protestada. Cobranças protestadas não recebem notificações e são excluídas dos gráficos.';