-- Corrigir contratos existentes que têm logs de sucesso mas estão sem assinafy_document_id
UPDATE contracts c
SET 
  assinafy_document_id = (al.response_data->'final'->>'document_id'),
  document_url = (al.response_data->'final'->>'signing_url'),
  signature_status = 'sent'
FROM assinafy_logs al
WHERE al.contract_id = c.id
  AND c.assinafy_document_id IS NULL
  AND al.status = 'success'
  AND al.response_data->'final'->>'document_id' IS NOT NULL;