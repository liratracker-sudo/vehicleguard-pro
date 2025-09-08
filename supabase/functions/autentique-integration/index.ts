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
    const autentiqueToken = Deno.env.get('AUTENTIQUE_API_TOKEN');

    if (!autentiqueToken) {
      throw new Error('Autentique API token not configured');
    }

    console.log('Autentique action:', action);

    switch (action) {
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

async function createDocument(contractData: ContractData, token: string) {
  const mutation = `
    mutation CreateDocument($document: CreateDocumentInput!) {
      createDocument(document: $document) {
        id
        name
        status
      }
    }
  `;

  const variables = {
    document: {
      name: contractData.contract_title,
      content: contractData.contract_content
    }
  };

  const response = await makeAutentiqueRequest(mutation, variables, token);

  return new Response(
    JSON.stringify({ 
      success: true, 
      document: response.data.createDocument 
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function sendForSignature(documentId: string, contractData: ContractData, token: string) {
  const mutation = `
    mutation CreateSigner($signer: CreateSignerInput!) {
      createSigner(signer: $signer) {
        id
        email
        name
        status
      }
    }
  `;

  const variables = {
    signer: {
      document_id: documentId,
      email: contractData.client_email,
      name: contractData.client_name,
      phone_number: contractData.client_phone,
      action: "SIGN"
    }
  };

  const response = await makeAutentiqueRequest(mutation, variables, token);

  return new Response(
    JSON.stringify({ 
      success: true, 
      signer: response.data.createSigner 
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Autentique API error:', errorText);
    throw new Error(`Autentique API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (data.errors) {
    console.error('Autentique GraphQL errors:', data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data;
}