-- Tabela para histórico de contatos de protestos
CREATE TABLE IF NOT EXISTS public.protest_contact_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('whatsapp', 'phone', 'email', 'visit', 'other')),
  contact_result TEXT NOT NULL CHECK (contact_result IN ('no_answer', 'promised_payment', 'refused', 'requested_deadline', 'negotiated', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para acordos de negociação
CREATE TABLE IF NOT EXISTS public.protest_negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  original_amount NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  final_amount NUMERIC(12,2) NOT NULL,
  installment_value NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  notes TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_protest_contact_history_company ON public.protest_contact_history(company_id);
CREATE INDEX IF NOT EXISTS idx_protest_contact_history_payment ON public.protest_contact_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_protest_contact_history_client ON public.protest_contact_history(client_id);
CREATE INDEX IF NOT EXISTS idx_protest_negotiations_company ON public.protest_negotiations(company_id);
CREATE INDEX IF NOT EXISTS idx_protest_negotiations_payment ON public.protest_negotiations(payment_id);

-- Habilitar RLS
ALTER TABLE public.protest_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protest_negotiations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para protest_contact_history
CREATE POLICY "Users can view their company protest contacts" 
ON public.protest_contact_history 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert protest contacts for their company" 
ON public.protest_contact_history 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company protest contacts" 
ON public.protest_contact_history 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para protest_negotiations
CREATE POLICY "Users can view their company negotiations" 
ON public.protest_negotiations 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert negotiations for their company" 
ON public.protest_negotiations 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company negotiations" 
ON public.protest_negotiations 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
  )
);