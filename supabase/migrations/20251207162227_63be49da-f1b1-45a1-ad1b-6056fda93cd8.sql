-- Renomear o campo autentique_document_id para assinafy_document_id
ALTER TABLE contracts RENAME COLUMN autentique_document_id TO assinafy_document_id;

-- Corrigir o contrato da Viviane que já foi assinado no Assinafy
UPDATE contracts 
SET 
  assinafy_document_id = '100dbfaa2ce0f6b72230d9b75f35',
  signature_status = 'signed',
  signed_at = NOW(),
  document_url = 'https://app.assinafy.com.br/sign/100dbfaa2ce0f6b72230d9b75f35'
WHERE id = 'e9ce4096-7073-4533-bdd1-0c24912678fb';