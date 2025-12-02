-- Tabela para relacionar contratos com múltiplos veículos
CREATE TABLE public.contract_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contract_id, vehicle_id)
);

-- Habilitar RLS
ALTER TABLE public.contract_vehicles ENABLE ROW LEVEL SECURITY;

-- Política de acesso baseada na empresa do contrato
CREATE POLICY "Company members can access contract_vehicles" 
ON public.contract_vehicles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM contracts c
    JOIN profiles p ON p.company_id = c.company_id
    WHERE c.id = contract_vehicles.contract_id
    AND p.user_id = auth.uid()
  )
);

-- Índice para performance
CREATE INDEX idx_contract_vehicles_contract_id ON public.contract_vehicles(contract_id);
CREATE INDEX idx_contract_vehicles_vehicle_id ON public.contract_vehicles(vehicle_id);