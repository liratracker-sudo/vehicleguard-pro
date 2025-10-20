-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  client_id UUID NOT NULL,
  license_plate TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  chassis TEXT,
  tracker_status TEXT NOT NULL DEFAULT 'active',
  tracker_device_id TEXT,
  installation_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(license_plate, company_id)
);

-- Enable RLS for vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create policy for vehicles
CREATE POLICY "Company members can access vehicles" 
ON public.vehicles 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = vehicles.company_id
));

-- Update contracts table to add vehicle relationship
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS vehicle_id UUID,
ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'service',
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS autentique_document_id TEXT;

-- Create payment_transactions table for billing
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  client_id UUID NOT NULL,
  contract_id UUID,
  invoice_id UUID,
  transaction_type TEXT NOT NULL, -- 'boleto', 'pix', 'link', 'card'
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'expired'
  payment_gateway TEXT, -- 'cora', 'asaas', 'mercadopago', 'efi'
  external_id TEXT,
  payment_url TEXT,
  pix_code TEXT,
  barcode TEXT,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for payment_transactions
CREATE POLICY "Company members can access payment transactions" 
ON public.payment_transactions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = payment_transactions.company_id
));

-- Create whatsapp_logs table for message tracking
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  client_id UUID,
  message_type TEXT NOT NULL, -- 'cobranca', 'lembrete', 'confirmacao'
  phone_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  external_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for whatsapp_logs
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for whatsapp_logs
CREATE POLICY "Company members can access whatsapp logs" 
ON public.whatsapp_logs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = whatsapp_logs.company_id
));

-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'cobranca', 'lembrete', 'confirmacao', 'boas_vindas'
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables like {nome}, {valor}, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for message_templates
CREATE POLICY "Company members can access message templates" 
ON public.message_templates 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = message_templates.company_id
));

-- Update triggers for updated_at columns
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();