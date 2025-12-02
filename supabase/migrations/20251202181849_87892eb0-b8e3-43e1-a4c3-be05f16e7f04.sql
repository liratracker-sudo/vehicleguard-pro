-- Adicionar campos de endereço e contato de emergência na tabela clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS number text,
ADD COLUMN IF NOT EXISTS complement text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- Adicionar campos has_gnv e is_armored na tabela vehicles
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS has_gnv boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_armored boolean DEFAULT false;