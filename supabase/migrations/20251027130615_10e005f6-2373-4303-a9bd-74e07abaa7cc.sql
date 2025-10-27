-- Criar tabela para mapear gateways de pagamento por método
CREATE TABLE IF NOT EXISTS public.payment_gateway_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('asaas', 'mercadopago', 'gerencianet', 'inter')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'boleto', 'credit_card', 'debit_card')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, gateway_type, payment_method)
);

-- RLS para payment_gateway_methods
ALTER TABLE public.payment_gateway_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their payment gateway methods"
  ON public.payment_gateway_methods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = payment_gateway_methods.company_id
    )
  );

CREATE POLICY "Company members can insert their payment gateway methods"
  ON public.payment_gateway_methods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = payment_gateway_methods.company_id
    )
  );

CREATE POLICY "Company members can update their payment gateway methods"
  ON public.payment_gateway_methods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = payment_gateway_methods.company_id
    )
  );

CREATE POLICY "Company members can delete their payment gateway methods"
  ON public.payment_gateway_methods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = payment_gateway_methods.company_id
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_payment_gateway_methods_updated_at
  BEFORE UPDATE ON public.payment_gateway_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();