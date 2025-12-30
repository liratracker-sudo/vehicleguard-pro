-- Adicionar coluna is_courtesy na tabela clients
ALTER TABLE public.clients 
ADD COLUMN is_courtesy boolean DEFAULT false;

COMMENT ON COLUMN public.clients.is_courtesy IS 'Indica se o cliente é cortesia (não paga)';