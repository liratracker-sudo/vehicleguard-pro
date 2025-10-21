-- Create assinafy_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS assinafy_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL, -- createDocument, sendForSignature, webhook, etc.
  status TEXT NOT NULL, -- success, error, pending
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_assinafy_logs_company_id ON assinafy_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_assinafy_logs_contract_id ON assinafy_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_assinafy_logs_created_at ON assinafy_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assinafy_logs_status ON assinafy_logs(status);

-- Enable RLS
ALTER TABLE assinafy_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their company's Assinafy logs
CREATE POLICY "Users can view their company's Assinafy logs"
  ON assinafy_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = assinafy_logs.company_id
    )
  );

-- System can insert Asaas logs
CREATE POLICY "System can insert Asaas logs"
  ON assinafy_logs
  FOR INSERT
  WITH CHECK (true);