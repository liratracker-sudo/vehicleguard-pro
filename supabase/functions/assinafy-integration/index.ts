import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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
    
    // Get company_id and contract_id for logging
    let companyId: string | undefined;
    let contractId: string | undefined;
    
    if (req.headers.get("authorization")?.startsWith("Bearer ")) {
      const token = req.headers.get("authorization")!.split(" ")[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        
        companyId = profile?.company_id;
        contractId = data.contract_id;
      }
    }
    
    switch (action) {
      case "testConnection":
        console.log("🔄 Testing connection...");
        return await testConnection(assinafyApiKey, assinafyWorkspaceId);
      case "createDocument":
        console.log("📄 Creating document...");
        return await createDocument(assinafyApiKey, assinafyWorkspaceId, data as ContractData, supabase, companyId, contractId);
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

async function createDocument(apiKey: string, workspaceId: string, contractData: ContractData, supabaseClient?: any, companyId?: string, contractId?: string): Promise<Response> {
  const logData = {
    operation_type: 'createDocument',
    request_data: {
      client_name: contractData.client_name,
      client_email: contractData.client_email,
      title: contractData.title
    },
    response_data: {} as any,
    error_message: null as string | null
  };

  try {
    let signerId: string;
    
    try {
      // First, try to get existing signer by email
      console.log("🔍 Checking for existing signer with email:", contractData.client_email);
      const existingSignerResponse = await makeAssinafyRequest(
        `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(contractData.client_email)}`,
        'GET',
        apiKey
      );
      
      const existingSignerData = await existingSignerResponse.json();
      console.log("📋 Existing signer response:", JSON.stringify(existingSignerData, null, 2));
      
      if (existingSignerData.data && existingSignerData.data.length > 0) {
        // Signer already exists, use existing ID
        signerId = existingSignerData.data[0].id;
        console.log("✅ Using existing signer:", signerId);
      } else {
        throw new Error("Signer not found, will create new one");
      }
    } catch (getSignerError) {
      // Signer doesn't exist, create new one
      console.log("➕ Creating new signer...");
      
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
        console.log("📋 Signer creation response:", JSON.stringify(signerData, null, 2));
        signerId = signerData.data.id;
        console.log("✅ New signer created:", signerId);
      } catch (createError: any) {
        // If creation fails because signer already exists, try to get it again
        if (createError.message.includes("já existe")) {
          console.log("🔄 Signer already exists, attempting to get existing signer...");
          
          const retrySignerResponse = await makeAssinafyRequest(
            `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(contractData.client_email)}`,
            'GET',
            apiKey
          );
          
          const retrySignerData = await retrySignerResponse.json();
          
          if (retrySignerData.data && retrySignerData.data.length > 0) {
            signerId = retrySignerData.data[0].id;
            console.log("✅ Retrieved existing signer after failed creation:", signerId);
          } else {
            throw new Error("Failed to create or retrieve signer");
          }
        } else {
          throw createError;
        }
      }
    }

    // Generate PDF content for the document
    console.log("📄 Generating PDF for contract:", contractData.title);
    
    const pdfBytes = await generateContractPDF(contractData);
    console.log("✅ PDF generated, size:", pdfBytes.length, "bytes");
    
    // Create PDF file multipart form data
    const fileName = `${contractData.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    console.log("📦 Preparing file upload:", fileName);
    
    // Upload document file using FormData
    const pdfBuffer = Uint8Array.from(atob(pdfBytes), c => c.charCodeAt(0));
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', pdfBlob, fileName);
    
    console.log("⬆️ Uploading document to Assinafy...");
    const uploadResponse = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("❌ Document upload failed:", errorText);
      logData.error_message = `Upload failed: ${errorText}`;
      throw new Error(`Erro no upload do documento: ${errorText}`);
    }

    const documentData = await uploadResponse.json();
    console.log("✅ Document uploaded successfully!");
    console.log("📋 Full response:", JSON.stringify(documentData, null, 2));
    
    logData.response_data.uploadResponse = documentData;

    // FIX: Access document ID correctly from response structure
    const documentId = documentData.data?.id || documentData.id;
    console.log("🔑 Extracted document ID:", documentId);
    
    if (!documentId) {
      console.error("❌ Document ID not found in response structure:", JSON.stringify(documentData, null, 2));
      logData.error_message = 'Document ID not found in API response';
      throw new Error('Documento criado mas ID não encontrado na resposta. Estrutura: ' + JSON.stringify(Object.keys(documentData)));
    }

    // Wait for document processing to complete
    console.log("⏳ Waiting for document processing to complete...");
    let documentReady = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 seconds max
    
    while (!documentReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
      
      try {
        const statusResponse = await fetch(
          `https://api.assinafy.com.br/v1/documents/${documentId}`,
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          }
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const currentStatus = statusData.data?.status;
          console.log(`📊 Document status (attempt ${attempts}): ${currentStatus}`);
          
          if (currentStatus === 'uploaded') {
            documentReady = true;
            console.log("✅ Document is ready for assignment!");
          } else if (currentStatus !== 'metadata_processing') {
            console.warn(`⚠️ Unexpected document status: ${currentStatus}`);
            break;
          }
        }
      } catch (error) {
        console.error("❌ Error checking document status:", error);
      }
    }
    
    if (!documentReady) {
      console.warn("⚠️ Document processing timeout, attempting assignment anyway...");
    }

    // Create assignment to assign the document to signers
    console.log("📝 Creating assignment for document:", documentId);
    console.log("📋 Assignment details - Signer ID:", signerId);
    
    const assignmentResponse = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/documents/${documentId}/assignments`,
      'POST',
      apiKey,
      {
        signer_ids: [signerId],
        method: "virtual",
        message: `Contrato: ${contractData.title}`
      }
    );
    
    if (!assignmentResponse.ok) {
      const errorText = await assignmentResponse.text();
      console.error("❌ Assignment creation failed:", errorText);
      logData.response_data.assignmentError = errorText;
      // Continue anyway, document was created
    } else {
      const assignmentData = await assignmentResponse.json();
      console.log("✅ Assignment created successfully!");
      console.log("📋 Assignment data:", JSON.stringify(assignmentData, null, 2));
      logData.response_data.assignment = assignmentData;
    }

    // Prepare signing URL
    const signingUrl = `https://app.assinafy.com.br/sign/${documentId}`;
    console.log("🔗 Signing URL:", signingUrl);
    
    logData.response_data.final = {
      document_id: documentId,
      signer_id: signerId,
      signing_url: signingUrl
    };

    // Save successful log to database
    if (supabaseClient && companyId) {
      try {
        await supabaseClient.from('assinafy_logs').insert({
          company_id: companyId,
          contract_id: contractId,
          operation_type: 'createDocument',
          status: 'success',
          request_data: logData.request_data,
          response_data: logData.response_data
        });
        console.log("✅ Log saved to database");
      } catch (logError) {
        console.error("⚠️ Failed to save log:", logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        signer_id: signerId,
        signing_url: signingUrl,
        client_email: contractData.client_email,
        client_name: contractData.client_name
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Create document error:", error);
    console.error("📋 Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Extract detailed error information
    let errorMessage = error.message || 'Erro desconhecido na criação do documento';
    let statusCode = 400;
    
    logData.error_message = errorMessage;
    
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
        console.error("⚠️ Failed to parse API error:", parseError);
      }
    }
    
    // Save error log to database
    if (supabaseClient && companyId) {
      try {
        await supabaseClient.from('assinafy_logs').insert({
          company_id: companyId,
          contract_id: contractId,
          operation_type: 'createDocument',
          status: 'error',
          request_data: logData.request_data,
          response_data: logData.response_data,
          error_message: errorMessage
        });
        console.log("✅ Error log saved to database");
      } catch (logError) {
        console.error("⚠️ Failed to save error log:", logError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: {
          originalError: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          logData: logData
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
  console.log("Request headers: Authorization present:", apiKey ? "✓" : "✗");
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
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

async function generateContractPDF(contractData: ContractData): Promise<string> {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Set font
    doc.setFont('helvetica');
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 123, 255);
    doc.text(contractData.title || 'Contrato de Prestação de Serviços', 105, 20, { align: 'center' });
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Client info section
    let yPosition = 50;
    doc.setFontSize(14);
    doc.setTextColor(0, 123, 255);
    doc.text('Informações do Cliente', 20, yPosition);
    
    yPosition += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Client info box
    doc.rect(15, yPosition - 5, 180, 25);
    doc.text(`Nome: ${contractData.client_name}`, 20, yPosition + 5);
    doc.text(`E-mail: ${contractData.client_email}`, 20, yPosition + 12);
    if (contractData.client_cpf) {
      doc.text(`CPF: ${contractData.client_cpf}`, 20, yPosition + 19);
    }
    
    yPosition += 35;
    
    // Contract content section
    doc.setFontSize(14);
    doc.setTextColor(0, 123, 255);
    doc.text('Conteúdo do Contrato', 20, yPosition);
    
    yPosition += 10;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    // Split content into lines and pages
    const lines = doc.splitTextToSize(contractData.content, 170);
    const pageHeight = 297; // A4 height in mm
    const marginBottom = 40; // Space for signatures
    
    for (let i = 0; i < lines.length; i++) {
      if (yPosition > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(lines[i], 20, yPosition);
      yPosition += 4;
    }
    
    // Signature section
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }
    
    yPosition += 20;
    
    // Date line
    doc.setFontSize(10);
    doc.text(`________________, ${new Date().toLocaleDateString('pt-BR')}`, 140, yPosition);
    
    yPosition += 30;
    
    // Client signature
    doc.line(20, yPosition, 90, yPosition);
    doc.text(contractData.client_name, 55, yPosition + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.text('CONTRATANTE', 55, yPosition + 12, { align: 'center' });
    
    // Company signature
    doc.line(110, yPosition, 180, yPosition);
    doc.setFontSize(10);
    doc.text('[Nome da Empresa]', 145, yPosition + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.text('CONTRATADA', 145, yPosition + 12, { align: 'center' });
    
    // Convert to base64 for transmission
    const pdfData = doc.output('datauristring');
    return pdfData.split(',')[1]; // Remove data URI prefix
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw new Error('Erro na geração do PDF: ' + (error instanceof Error ? error.message : String(error)));
  }
}


function generateContractHTML(contractData: ContractData): string {
  const today = new Date().toLocaleDateString('pt-BR');
  
  return `<!DOCTYPE html>
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
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
        }
        .content {
            margin: 20px 0;
            text-align: justify;
        }
        .signature-area {
            margin-top: 50px;
            border-top: 1px solid #ccc;
            padding-top: 30px;
        }
        .client-info {
            background-color: #f5f5f5;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${contractData.title}</h1>
        <p><strong>Data:</strong> ${today}</p>
    </div>
    
    <div class="client-info">
        <h3>CONTRATANTE:</h3>
        <p><strong>Nome:</strong> ${contractData.client_name}</p>
        <p><strong>E-mail:</strong> ${contractData.client_email}</p>
        ${contractData.client_cpf ? `<p><strong>CPF:</strong> ${contractData.client_cpf}</p>` : ''}
    </div>
    
    <div class="content">
        ${contractData.content.replace(/\n/g, '<br>')}
    </div>
    
    <div class="signature-area">
        <p>_________________________________</p>
        <p><strong>${contractData.client_name}</strong></p>
        <p>Assinatura Digital</p>
    </div>
</body>
</html>`;
}
