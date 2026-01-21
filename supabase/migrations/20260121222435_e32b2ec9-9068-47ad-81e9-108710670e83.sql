-- Alterar constraint de CASCADE para RESTRICT
-- Isso impede a deleção de planos que possuem contratos vinculados

-- Remover constraint atual (que tem ON DELETE CASCADE)
ALTER TABLE contracts 
DROP CONSTRAINT IF EXISTS contracts_plan_id_fkey;

-- Recriar com RESTRICT (bloqueia deleção se houver contratos)
ALTER TABLE contracts 
ADD CONSTRAINT contracts_plan_id_fkey 
FOREIGN KEY (plan_id) 
REFERENCES plans(id) 
ON DELETE RESTRICT;