-- Add Assinafy integration fields to companies table
ALTER TABLE public.companies ADD COLUMN assinafy_api_key TEXT;
ALTER TABLE public.companies ADD COLUMN assinafy_workspace_id TEXT;

-- Update contracts table to support Assinafy
ALTER TABLE public.contracts ADD COLUMN assinafy_document_id TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_contracts_assinafy_document_id ON public.contracts(assinafy_document_id);