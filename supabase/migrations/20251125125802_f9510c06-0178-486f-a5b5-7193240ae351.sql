-- Criar tabela de cadastros de clientes pendentes
CREATE TABLE IF NOT EXISTS public.client_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Dados Pessoais
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  document TEXT NOT NULL,
  
  -- Endereço
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  
  -- Contato de Emergência
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_relationship TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  
  -- Dados do Veículo
  vehicle_plate TEXT NOT NULL,
  vehicle_brand TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  vehicle_color TEXT NOT NULL,
  has_gnv BOOLEAN DEFAULT false,
  is_armored BOOLEAN DEFAULT false,
  
  -- Documentos (URLs no storage)
  document_front_url TEXT,
  document_back_url TEXT,
  
  -- Status e Controle
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Dados convertidos (após aprovação)
  client_id UUID REFERENCES clients(id),
  vehicle_id UUID REFERENCES vehicles(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.client_registrations ENABLE ROW LEVEL SECURITY;

-- Política para inserção pública (qualquer um pode cadastrar)
CREATE POLICY "Anyone can insert registrations"
ON public.client_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Política para visualização pelos membros da empresa
CREATE POLICY "Company members can view registrations"
ON public.client_registrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = client_registrations.company_id
  )
);

-- Política para atualização pelos membros da empresa
CREATE POLICY "Company members can update registrations"
ON public.client_registrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = client_registrations.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = client_registrations.company_id
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_registrations_updated_at
  BEFORE UPDATE ON public.client_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para documentos dos clientes
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Política para upload público de documentos
CREATE POLICY "Anyone can upload client documents"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'client-documents');

-- Política para visualização apenas por membros autenticados
CREATE POLICY "Authenticated users can view client documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client-documents');