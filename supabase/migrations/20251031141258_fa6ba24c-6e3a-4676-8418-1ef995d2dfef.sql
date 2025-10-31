-- Relaxar políticas RLS para permitir acesso público à página de checkout
-- Permitir leitura pública de payment_transactions para checkout
CREATE POLICY "Public can view payment for checkout"
  ON payment_transactions
  FOR SELECT
  USING (true);

-- Permitir leitura pública de payment_gateway_methods para checkout
CREATE POLICY "Public can view payment gateway methods"
  ON payment_gateway_methods
  FOR SELECT
  USING (true);

-- Permitir leitura pública de clients para checkout
CREATE POLICY "Public can view clients for checkout"
  ON clients
  FOR SELECT
  USING (true);

-- Permitir leitura pública de companies para checkout
CREATE POLICY "Public can view companies for checkout"
  ON companies
  FOR SELECT
  USING (true);