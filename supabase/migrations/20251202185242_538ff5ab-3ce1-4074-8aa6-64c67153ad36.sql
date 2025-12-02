-- Criar tabela para veículos de cadastros
CREATE TABLE public.client_registration_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES client_registrations(id) ON DELETE CASCADE,
  vehicle_plate text NOT NULL,
  vehicle_brand text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer NOT NULL,
  vehicle_color text NOT NULL,
  has_gnv boolean DEFAULT false,
  is_armored boolean DEFAULT false,
  vehicle_id uuid REFERENCES vehicles(id),
  created_at timestamptz DEFAULT now()
);

-- Índice para performance
CREATE INDEX idx_registration_vehicles_registration_id 
  ON client_registration_vehicles(registration_id);

-- Habilitar RLS
ALTER TABLE client_registration_vehicles ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode inserir (formulário público)
CREATE POLICY "Anyone can insert registration vehicles"
  ON client_registration_vehicles FOR INSERT
  WITH CHECK (true);

-- Política: membros da empresa podem visualizar
CREATE POLICY "Company members can view registration vehicles"
  ON client_registration_vehicles FOR SELECT
  USING (
    registration_id IN (
      SELECT id FROM client_registrations 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política: membros da empresa podem atualizar
CREATE POLICY "Company members can update registration vehicles"
  ON client_registration_vehicles FOR UPDATE
  USING (
    registration_id IN (
      SELECT id FROM client_registrations 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política: membros da empresa podem deletar
CREATE POLICY "Company members can delete registration vehicles"
  ON client_registration_vehicles FOR DELETE
  USING (
    registration_id IN (
      SELECT id FROM client_registrations 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Migrar dados existentes para a nova tabela
INSERT INTO client_registration_vehicles 
  (registration_id, vehicle_plate, vehicle_brand, vehicle_model, vehicle_year, vehicle_color, has_gnv, is_armored, vehicle_id)
SELECT 
  id,
  vehicle_plate,
  vehicle_brand,
  vehicle_model,
  vehicle_year,
  vehicle_color,
  COALESCE(has_gnv, false),
  COALESCE(is_armored, false),
  vehicle_id
FROM client_registrations
WHERE vehicle_plate IS NOT NULL AND vehicle_plate != '';