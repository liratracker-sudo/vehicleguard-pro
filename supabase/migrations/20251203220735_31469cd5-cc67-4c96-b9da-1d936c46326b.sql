-- Habilitar REPLICA IDENTITY FULL para capturar todos os dados nas mudanças
ALTER TABLE public.client_registrations REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_registrations;