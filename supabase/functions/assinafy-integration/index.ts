import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractData {
  client_name: string;
  client_email: string;
  client_cpf?: string;
  content: string;
  title: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("Received request:", req.method);
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    const { action, apiKey, workspaceId, ...data } = requestBody;

    // Get API key and workspace ID from headers, user profile, or request body
    let assinafyApiKey = apiKey || req.headers.get("x-assinafy-api-key");
    let assinafyWorkspaceId = workspaceId;
    
    if (!assinafyApiKey || !assinafyWorkspaceId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError) {
          console.error("Auth error:", userError);
          return new Response(
            JSON.stringify({ error: "Erro de autenticação" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .single();
            
          if (profileError) {
            console.error("Profile error:", profileError);
          }
            
          if (profile?.company_id) {
            const { data: company, error: companyError } = await supabase
              .from('companies')
              .select('assinafy_api_key, assinafy_workspace_id')
              .eq('id', profile.company_id)
              .single();
              
            if (companyError) {
              console.error("Company error:", companyError);
            }
              
            assinafyApiKey = assinafyApiKey || company?.assinafy_api_key;
            assinafyWorkspaceId = assinafyWorkspaceId || company?.assinafy_workspace_id;
          }
        }
      }
    }

    console.log("Using API Key:", assinafyApiKey ? "***configured***" : "NOT FOUND");
    console.log("Using Workspace ID:", assinafyWorkspaceId ? "***configured***" : "NOT FOUND");
    console.log("Action requested:", action);

    if (!assinafyApiKey) {
      return new Response(
        JSON.stringify({ error: "API key do Assinafy não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!assinafyWorkspaceId && action !== 'testConnection') {
      return new Response(
        JSON.stringify({ error: "Workspace ID do Assinafy não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "testConnection":
        return await testConnection(assinafyApiKey, assinafyWorkspaceId);
      case "createDocument":
        return await createDocument(assinafyApiKey, assinafyWorkspaceId, data as ContractData);
      case "sendForSignature":
        return await sendForSignature(assinafyApiKey, data.documentId, data.signerEmail, data.signerName);
      case "getDocumentStatus":
        return await getDocumentStatus(assinafyApiKey, data.documentId);
      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("Assinafy integration error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testConnection(apiKey: string, workspaceId: string): Promise<Response> {
  try {
    console.log("Testing connection with API key:", apiKey ? "present" : "missing");
    console.log("Testing connection with workspace ID:", workspaceId ? "present" : "missing");
    
    if (!workspaceId) {
      throw new Error("Workspace ID não configurado");
    }
    
    // Test API connection by getting workspace info
    const response = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?per-page=1`,
      'GET',
      apiKey
    );

    if (response.status === 200) {
      return new Response(
        JSON.stringify({ success: true, message: "Conexão estabelecida com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("Falha na conexão com Assinafy");
    }
  } catch (error: any) {
    console.error("Assinafy test connection error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function createDocument(apiKey: string, workspaceId: string, contractData: ContractData): Promise<Response> {
  try {
    // First, create/get signer
    const signerResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`,
      'POST',
      apiKey,
      {
        full_name: contractData.client_name,
        email: contractData.client_email,
        government_id: contractData.client_cpf || undefined
      }
    );

    const signerData = await signerResponse.json();
    console.log("Signer created:", signerData);

    // Generate HTML content for the document
    const htmlContent = generateContractHTML(contractData);
    
    // Create a temporary file with the HTML content
    const encoder = new TextEncoder();
    const htmlBuffer = encoder.encode(htmlContent);
    
    // Upload document
    const formData = new FormData();
    const blob = new Blob([htmlBuffer], { type: 'text/html' });
    formData.append('file', blob, `${contractData.title}.html`);

    const uploadResponse = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/documents`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Erro no upload do documento: ${errorText}`);
    }

    const documentData = await uploadResponse.json();
    console.log("Document created:", documentData);

    // Create assignment for signature
    const assignmentResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/documents/${documentData.id}/assignments`,
      'POST',
      apiKey,
      {
        method: "virtual",
        signer_ids: [signerData.data.id],
        message: `Olá ${contractData.client_name}, por favor assine este contrato.`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }
    );

    const assignmentData = await assignmentResponse.json();
    console.log("Assignment created:", assignmentData);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentData.id,
        signer_id: signerData.data.id,
        assignment_id: assignmentData.id,
        signing_url: `https://app.assinafy.com.br/sign/${documentData.id}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Create document error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function sendForSignature(apiKey: string, documentId: string, signerEmail: string, signerName: string): Promise<Response> {
  console.log("Sending for signature - Assinafy handles this automatically when assignment is created");
  
  return new Response(
    JSON.stringify({ success: true, message: "Convite de assinatura enviado automaticamente" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getDocumentStatus(apiKey: string, documentId: string): Promise<Response> {
  try {
    const response = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/documents/${documentId}`,
      'GET',
      apiKey
    );

    const documentData = await response.json();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: documentData.data.status,
        document: documentData.data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Get document status error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function makeAssinafyRequest(url: string, method: string, apiKey: string, body?: any): Promise<Response> {
  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
  };

  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Assinafy API error (${response.status}):`, errorText);
    throw new Error(`Erro da API Assinafy: ${response.status} - ${errorText}`);
  }

  return response;
}

function generateContractHTML(contractData: ContractData): string {
  const today = new Date().toLocaleDateString('pt-BR');
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contractData.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 40px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .contract-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .content {
            text-align: justify;
            margin-bottom: 40px;
        }
        .signature-section {
            margin-top: 60px;
            text-align: center;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            width: 300px;
            margin: 40px auto 10px;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="contract-title">${contractData.title}</h1>
    </div>
    
    <div class="date">
        <p>Data: ${today}</p>
    </div>
    
    <div class="content">
        <p><strong>Contratante:</strong> ${contractData.client_name}</p>
        <p><strong>Email:</strong> ${contractData.client_email}</p>
        ${contractData.client_cpf ? `<p><strong>CPF:</strong> ${contractData.client_cpf}</p>` : ''}
        
        <br>
        
        <div>${contractData.content.replace(/\n/g, '<br>')}</div>
    </div>
    
    <div class="signature-section">
        <div class="signature-line"></div>
        <p><strong>${contractData.client_name}</strong><br>Assinatura Digital</p>
    </div>
</body>
</html>
  `;
}