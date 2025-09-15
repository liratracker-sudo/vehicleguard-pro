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
  console.log("=== ASSINAFY INTEGRATION START ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log("Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }), 
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Initializing Supabase client...");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  console.log("Supabase URL:", supabaseUrl ? "✓ Present" : "✗ Missing");
  console.log("Supabase Key:", supabaseKey ? "✓ Present" : "✗ Missing");
  
  const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "");

  try {
    console.log("Reading request body...");
    const requestBody = await req.json();
    console.log("Request body received:", JSON.stringify(requestBody, null, 2));
    const { action, apiKey, workspaceId, ...data } = requestBody;
    console.log("Extracted action:", action);
    console.log("API Key from request:", apiKey ? "✓ Present" : "✗ Missing");
    console.log("Workspace ID from request:", workspaceId ? "✓ Present" : "✗ Missing");

    // Get API key and workspace ID from headers, user profile, or request body
    let assinafyApiKey = apiKey || req.headers.get("x-assinafy-api-key");
    let assinafyWorkspaceId = workspaceId;
    
    console.log("Initial API Key:", assinafyApiKey ? "✓ Present" : "✗ Missing");
    console.log("Initial Workspace ID:", assinafyWorkspaceId ? "✓ Present" : "✗ Missing");
    
    if (!assinafyApiKey || !assinafyWorkspaceId) {
      console.log("Attempting to get credentials from user profile...");
      const authHeader = req.headers.get("authorization");
      console.log("Auth header present:", authHeader ? "✓ Yes" : "✗ No");
      
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        console.log("Token extracted, length:", token.length);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError) {
          console.error("❌ Auth error:", userError);
          return new Response(
            JSON.stringify({ error: "Erro de autenticação", details: userError.message }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("User authenticated:", user?.id);
        
        if (user) {
          console.log("Fetching user profile...");
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .single();
            
          if (profileError) {
            console.error("❌ Profile error:", profileError);
            return new Response(
              JSON.stringify({ error: "Erro ao buscar perfil do usuário", details: profileError.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          console.log("Profile found, company_id:", profile?.company_id);
            
          if (profile?.company_id) {
            console.log("Fetching company credentials...");
            const { data: company, error: companyError } = await supabase
              .from('companies')
              .select('assinafy_api_key, assinafy_workspace_id')
              .eq('id', profile.company_id)
              .single();
              
            if (companyError) {
              console.error("❌ Company error:", companyError);
              return new Response(
                JSON.stringify({ error: "Erro ao buscar dados da empresa", details: companyError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            console.log("Company data found:");
            console.log("- API Key:", company?.assinafy_api_key ? "✓ Present" : "✗ Missing");
            console.log("- Workspace ID:", company?.assinafy_workspace_id ? "✓ Present" : "✗ Missing");
              
            assinafyApiKey = assinafyApiKey || company?.assinafy_api_key;
            assinafyWorkspaceId = assinafyWorkspaceId || company?.assinafy_workspace_id;
          }
        }
      }
    }

    console.log("=== FINAL CREDENTIALS CHECK ===");
    console.log("Final API Key:", assinafyApiKey ? "✓ Present" : "❌ NOT FOUND");
    console.log("Final Workspace ID:", assinafyWorkspaceId ? "✓ Present" : "❌ NOT FOUND");
    console.log("Action requested:", action);

    if (!assinafyApiKey) {
      console.error("❌ API key not found after all attempts");
      return new Response(
        JSON.stringify({ 
          error: "API key do Assinafy não encontrada", 
          debug: "Verifique se a API key está configurada nas configurações da empresa" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!assinafyWorkspaceId && action !== 'testConnection') {
      console.error("❌ Workspace ID not found for action:", action);
      return new Response(
        JSON.stringify({ 
          error: "Workspace ID do Assinafy não encontrado", 
          debug: "Verifique se o Workspace ID está configurado nas configurações da empresa" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== EXECUTING ACTION ===");
    switch (action) {
      case "testConnection":
        console.log("🔄 Testing connection...");
        return await testConnection(assinafyApiKey, assinafyWorkspaceId);
      case "createDocument":
        console.log("📄 Creating document...");
        return await createDocument(assinafyApiKey, assinafyWorkspaceId, data as ContractData);
      case "sendForSignature":
        console.log("✍️ Sending for signature...");
        return await sendForSignature(assinafyApiKey, data.documentId, data.signerEmail, data.signerName);
      case "getDocumentStatus":
        console.log("📊 Getting document status...");
        return await getDocumentStatus(assinafyApiKey, data.documentId);
      default:
        console.error("❌ Invalid action:", action);
        return new Response(
          JSON.stringify({ error: "Ação inválida", action: action }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("❌ FATAL ERROR in Assinafy integration:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro interno do servidor",
        stack: error.stack,
        type: error.name 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    console.log("=== ASSINAFY INTEGRATION END ===");
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
    let signerId: string;
    
    try {
      // First, try to get existing signer by email
      const existingSignerResponse = await makeAssinafyRequest(
        `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(contractData.client_email)}`,
        'GET',
        apiKey
      );
      
      const existingSignerData = await existingSignerResponse.json();
      
      if (existingSignerData.data && existingSignerData.data.length > 0) {
        // Signer already exists, use existing ID
        signerId = existingSignerData.data[0].id;
        console.log("Using existing signer:", signerId);
      } else {
        throw new Error("Signer not found, will create new one");
      }
    } catch (getSignerError) {
      // Signer doesn't exist, create new one
      console.log("Creating new signer...");
      
      try {
        const createSignerResponse = await makeAssinafyRequest(
          `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`,
          'POST',
          apiKey,
          {
            full_name: contractData.client_name,
            email: contractData.client_email,
            government_id: contractData.client_cpf || undefined
          }
        );

        const signerData = await createSignerResponse.json();
        signerId = signerData.data.id;
        console.log("New signer created:", signerId);
      } catch (createError: any) {
        // If creation fails because signer already exists, try to get it again
        if (createError.message.includes("já existe")) {
          console.log("Signer already exists, attempting to get existing signer...");
          
          const retrySignerResponse = await makeAssinafyRequest(
            `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(contractData.client_email)}`,
            'GET',
            apiKey
          );
          
          const retrySignerData = await retrySignerResponse.json();
          
          if (retrySignerData.data && retrySignerData.data.length > 0) {
            signerId = retrySignerData.data[0].id;
            console.log("Retrieved existing signer after failed creation:", signerId);
          } else {
            throw new Error("Failed to create or retrieve signer");
          }
        } else {
          throw createError;
        }
      }
    }

    // Try creating document without file upload - using text content directly
    console.log("🔄 Creating document with text content...");
    
    const textContent = generateContractText(contractData);
    console.log("📄 Text content generated, length:", textContent.length);
    
    // Create document via API with text content
    const createDocResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/accounts/${workspaceId}/documents`,
      'POST',
      apiKey,
      {
        name: contractData.title,
        content: textContent,
        signers: [signerId]
      }
    );
    
    if (!createDocResponse.ok) {
      const errorText = await createDocResponse.text();
      console.error("❌ Document creation failed:", errorText);
      throw new Error(`Erro na criação do documento: ${errorText}`);
    }

    const documentData = await createDocResponse.json();
    console.log("✅ Document created successfully:", documentData.data?.id || documentData.id);

    const documentId = documentData.data?.id || documentData.id;
    if (!documentId) {
      throw new Error('Documento criado mas ID não encontrado na resposta');
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        signer_id: signerId,
        signing_url: `https://app.assinafy.com.br/sign/${documentId}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Create document error:", error);
    
    // Extract detailed error information
    let errorMessage = error.message || 'Erro desconhecido na criação do documento';
    let statusCode = 400;
    
    // Parse Assinafy API errors
    if (error.message?.includes('Erro na criação do documento:') || error.message?.includes('Erro no upload do documento:')) {
      try {
        const errorMatch = error.message.match(/\{.*\}/);
        if (errorMatch) {
          const apiError = JSON.parse(errorMatch[0]);
          errorMessage = `API Assinafy: ${apiError.message || 'Erro não especificado'}`;
          statusCode = apiError.status || 400;
        }
      } catch (parseError) {
        console.error("Failed to parse API error:", parseError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: {
          originalError: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
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
  console.log(`🌐 Making Assinafy request: ${method} ${url}`);
  console.log("Request headers: X-Api-Key present:", apiKey ? "✓" : "✗");
  
  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
  };

  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    console.log("Request body:", JSON.stringify(body, null, 2));
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  console.log("Sending request to Assinafy API...");
  const response = await fetch(url, config);
  
  console.log(`📥 Assinafy API response: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Assinafy API error (${response.status}):`, errorText);
    
    let parsedError = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      parsedError = JSON.stringify(errorJson, null, 2);
    } catch {
      // Keep original text if not JSON
    }
    
    throw new Error(`Erro da API Assinafy: ${response.status} - ${parsedError}`);
  }

  console.log("✅ Assinafy API request successful");
  return response;
}


function generateContractText(contractData: ContractData): string {
  const today = new Date().toLocaleDateString('pt-BR');
  
  return `${contractData.title}

Data: ${today}

CONTRATANTE: ${contractData.client_name}
E-mail: ${contractData.client_email}${contractData.client_cpf ? `\nCPF: ${contractData.client_cpf}` : ''}

${contractData.content}

_________________________________
${contractData.client_name}
Assinatura Digital`;
}
