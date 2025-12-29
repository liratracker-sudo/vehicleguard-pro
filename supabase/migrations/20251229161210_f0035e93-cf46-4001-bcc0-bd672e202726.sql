-- Criar tabela de regras de gateway de pagamento
CREATE TABLE public.payment_gateway_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Condições da regra
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC, -- NULL = sem limite máximo
  
  -- Gateways permitidos (array: 'asaas', 'mercadopago', 'inter', 'gerencianet')
  allowed_gateways TEXT[] NOT NULL DEFAULT '{}',
  
  -- Métodos de pagamento permitidos (array: 'pix', 'boleto', 'credit_card')
  allowed_methods TEXT[] DEFAULT '{}',
  
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna de restrições específicas em payment_transactions
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS gateway_restrictions JSONB DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN payment_transactions.gateway_restrictions IS 'Restrições específicas de gateway para esta cobrança. Formato: {"gateways": ["asaas"], "methods": ["pix", "boleto"]}';

-- Habilitar RLS
ALTER TABLE public.payment_gateway_rules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Company members can view their gateway rules"
ON public.payment_gateway_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = payment_gateway_rules.company_id
));

CREATE POLICY "Company members can insert gateway rules"
ON public.payment_gateway_rules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = payment_gateway_rules.company_id
));

CREATE POLICY "Company members can update their gateway rules"
ON public.payment_gateway_rules FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = payment_gateway_rules.company_id
));

CREATE POLICY "Company members can delete their gateway rules"
ON public.payment_gateway_rules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
  AND profiles.company_id = payment_gateway_rules.company_id
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_payment_gateway_rules_updated_at
BEFORE UPDATE ON public.payment_gateway_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_payment_gateway_rules_company_id ON public.payment_gateway_rules(company_id);
CREATE INDEX idx_payment_gateway_rules_active ON public.payment_gateway_rules(company_id, is_active) WHERE is_active = true;