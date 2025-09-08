import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContractData {
  client_name: string;
  client_email: string;
  client_phone: string;
  contract_content: string;
  contract_title: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, contractData, documentId } = await req.json();

    // Buscar o token da API do Autentique das configurações da empresa
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    const { data: company } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', profile.company_id)
      .single();

    const companySettings = company?.settings as any;
    const autentiqueToken = companySettings?.autentique_api_token;

    if (!autentiqueToken) {
      throw new Error('Token da API Autentique não configurado. Configure nas Configurações > Autentique.');
    }

    console.log('Autentique action:', action);

    switch (action) {
      case 'test_connection':
        return await testConnection(autentiqueToken);
      
      case 'create_document':
        return await createDocument(contractData, autentiqueToken);
      
      case 'send_for_signature':
        return await sendForSignature(documentId, contractData, autentiqueToken);
      
      case 'get_document_status':
        return await getDocumentStatus(documentId, autentiqueToken);
      
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in autentique-integration:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function testConnection(token: string) {
  // Fazer uma consulta simples para testar a conexão
  const query = `
    query {
      viewer {
        id
        name
        email
      }
    }
  `;
  
  const response = await makeAutentiqueRequest(query, {}, token);
  
  return new Response(
    JSON.stringify({ 
      success: true,
      status: 'connected', 
      user: response.data.viewer,
      message: 'Conexão com Autentique estabelecida com sucesso!'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function createDocument(contractData: ContractData, token: string) {
  // Create HTML content for the document
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${contractData.contract_title}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
        h1 { text-align: center; color: #333; }
        .content { margin: 20px 0; }
        .client-info { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; }
    </style>
</head>
<body>
    <h1>${contractData.contract_title}</h1>
    <div class="content">
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${contractData.contract_content}</pre>
    </div>
    <div class="client-info">
        <p><strong>Cliente:</strong> ${contractData.client_name}</p>
        <p><strong>E-mail:</strong> ${contractData.client_email}</p>
        ${contractData.client_phone ? `<p><strong>Telefone:</strong> ${contractData.client_phone}</p>` : ''}
    </div>
</body>
</html>`;

  // Create multipart form data
  const formData = new FormData();
  
  // Add the GraphQL query
  const mutation = `
    mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        status
        created_at
      }
    }
  `;

  const variables = {
    document: {
      name: contractData.contract_title,
      sandbox: true // Use sandbox mode to avoid consuming credits during testing
    },
    signers: [{
      email: contractData.client_email,
      name: contractData.client_name,
      action: "SIGN"
    }]
  };

  // Create a blob from HTML content
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  
  formData.append('operations', JSON.stringify({
    query: mutation,
    variables: variables
  }));
  
  formData.append('map', JSON.stringify({
    "0": ["variables.file"]
  }));
  
  formData.append('0', htmlBlob, `${contractData.contract_title}.html`);

  console.log('Sending document to Autentique:', {
    title: contractData.contract_title,
    clientEmail: contractData.client_email
  });

  const response = await fetch('https://api.autentique.com.br/v2/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData
  });

  console.log('Autentique API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Autentique API HTTP error:', { status: response.status, error: errorText });
    throw new Error(`Erro na API Autentique (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('Autentique API response data:', JSON.stringify(data, null, 2));

  if (data.errors) {
    console.error('Autentique GraphQL errors:', data.errors);
    throw new Error(`Erro GraphQL: ${data.errors.map((e: any) => e.message).join(', ')}`);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      document: data.data.createDocument 
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function sendForSignature(documentId: string, contractData: ContractData, token: string) {
  // Para documentos criados com signatários, eles já recebem automaticamente o email
  // Esta função pode ser usada para adicionar signatários adicionais se necessário
  
  console.log('Document created and signature link already sent to:', contractData.client_email);
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Document created and signature email already sent automatically'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function getDocumentStatus(documentId: string, token: string) {
  const query = `
    query GetDocument($id: ID!) {
      document(id: $id) {
        id
        name
        status
        created_at
        updated_at
        signers {
          id
          name
          email
          status
          signed_at
        }
      }
    }
  `;

  const variables = { id: documentId };

  const response = await makeAutentiqueRequest(query, variables, token);

  return new Response(
    JSON.stringify({ 
      success: true, 
      document: response.data.document 
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function makeAutentiqueRequest(query: string, variables: any, token: string) {
  console.log('Making Autentique API request:', { query: query.substring(0, 100) + '...', variables });
  
  const response = await fetch('https://api.autentique.com.br/v2/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  console.log('Autentique API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Autentique API HTTP error:', { status: response.status, error: errorText });
    throw new Error(`Erro na API Autentique (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('Autentique API response data:', JSON.stringify(data, null, 2));

  if (data.errors) {
    console.error('Autentique GraphQL errors:', data.errors);
    throw new Error(`Erro GraphQL: ${data.errors.map((e: any) => e.message).join(', ')}`);
  }

  return data;
}