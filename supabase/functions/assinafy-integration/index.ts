import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= LOCAL ENCRYPTION FUNCTIONS =============
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufToBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getAesKey(secret: string): Promise<CryptoKey> {
  const keyData = textEncoder.encode(secret.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptTokenLocal(token: string, secret: string): Promise<string> {
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(token)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bufToBase64(combined.buffer);
}

async function decryptTokenLocal(encrypted: string, secret: string): Promise<string> {
  const key = await getAesKey(secret);
  const combined = new Uint8Array(base64ToBuf(encrypted));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return textDecoder.decode(decrypted);
}
// ============= END LOCAL ENCRYPTION FUNCTIONS =============

interface ContractData {
  client_name: string;
  client_email: string;
  client_cpf?: string;
  content: string;
  title: string;
  // Dados da empresa
  company_name?: string;
  company_cnpj?: string;
  company_address?: string;
  company_owner?: string;
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
            console.log("Fetching Assinafy settings...");
            const { data: settings, error: settingsError } = await supabase
              .from('assinafy_settings')
              .select('api_token_encrypted, workspace_id, is_active')
              .eq('company_id', profile.company_id)
              .eq('is_active', true)
              .maybeSingle();
              
            if (settingsError) {
              console.error("❌ Settings error:", settingsError);
              return new Response(
                JSON.stringify({ error: "Erro ao buscar configurações do Assinafy", details: settingsError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            if (settings) {
              console.log("Assinafy settings found, decrypting...");
              
              // Decrypt API token using local encryption
              const encryptionKey = Deno.env.get('ASAAS_ENCRYPTION_KEY');
              let decryptedToken: string | null = null;
              
              if (encryptionKey && settings.api_token_encrypted) {
                try {
                  decryptedToken = await decryptTokenLocal(settings.api_token_encrypted, encryptionKey);
                } catch (decryptError) {
                  console.error("Error decrypting token:", decryptError);
                }
              }
              
              console.log("Settings data found:");
              console.log("- API Key:", decryptedToken ? "✓ Present (decrypted)" : "✗ Missing");
              console.log("- Workspace ID:", settings.workspace_id ? "✓ Present" : "✗ Missing");
                
              assinafyApiKey = assinafyApiKey || decryptedToken;
              assinafyWorkspaceId = assinafyWorkspaceId || settings.workspace_id;
            } else {
              console.log("⚠️ No Assinafy settings found for company");
            }
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
      case "saveSettings":
        console.log("💾 Saving Assinafy settings...");
        return await saveSettings(supabase, data.company_id, apiKey, workspaceId);
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
      case "syncStatus":
        console.log("🔄 Syncing document status...");
        // Support both document_id (from frontend) and documentId
        const syncDocId = data.document_id || data.documentId;
        console.log("📄 Document ID to sync:", syncDocId);
        return await syncDocumentStatus(assinafyApiKey, syncDocId, supabase);
      case "downloadDocument":
        console.log("📥 Downloading document...");
        const downloadDocId = data.document_id || data.documentId;
        console.log("📄 Document ID to download:", downloadDocId);
        return await downloadDocument(assinafyApiKey, downloadDocId);
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

async function saveSettings(supabaseClient: any, companyId: string, apiKey: string, workspaceId: string): Promise<Response> {
  try {
    console.log("Saving Assinafy settings for company:", companyId);
    
    if (!companyId || !apiKey || !workspaceId) {
      throw new Error("Company ID, API Key e Workspace ID são obrigatórios");
    }
    
    // Get encryption key from environment
    const encryptionKey = Deno.env.get('ASAAS_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error("Encryption key not found in environment");
      throw new Error("Chave de criptografia não configurada no servidor");
    }
    
    // Encrypt API key using local encryption
    const encryptedToken = await encryptTokenLocal(apiKey, encryptionKey);
    console.log("API key encrypted successfully");
    
    // Check if settings already exist
    const { data: existingSettings } = await supabaseClient
      .from('assinafy_settings')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();
    
    if (existingSettings) {
      // Update existing settings
      const { error } = await supabaseClient
        .from('assinafy_settings')
        .update({
          api_token_encrypted: encryptedToken,
          workspace_id: workspaceId,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);
      
      if (error) {
        console.error("Error updating Assinafy settings:", error);
        throw error;
      }
    } else {
      // Insert new settings
      const { error } = await supabaseClient
        .from('assinafy_settings')
        .insert({
          company_id: companyId,
          api_token_encrypted: encryptedToken,
          workspace_id: workspaceId,
          is_active: true
        });
      
      if (error) {
        console.error("Error inserting Assinafy settings:", error);
        throw error;
      }
    }
    
    console.log("✅ Assinafy settings saved successfully");
    
    return new Response(
      JSON.stringify({ success: true, message: "Configurações salvas com sucesso!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in saveSettings:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

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
    // Helper function to get or create a signer with improved resilience
    const getOrCreateSigner = async (email: string, name: string, cpf?: string): Promise<string> => {
      // Normalizar email para evitar problemas de case sensitivity
      const normalizedEmail = email.trim().toLowerCase();
      console.log("🔍 Checking for existing signer with email:", normalizedEmail);
      
      // 1. Tentar buscar com paginação aumentada
      try {
        const existingSignerResponse = await makeAssinafyRequest(
          `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?email=${encodeURIComponent(normalizedEmail)}&per-page=50`,
          'GET',
          apiKey
        );
        
        const existingSignerData = await existingSignerResponse.json();
        console.log("📥 Search response count:", existingSignerData.data?.length || 0);
        
        if (existingSignerData.data && existingSignerData.data.length > 0) {
          // Busca com normalização para comparação exata
          const matchingSigner = existingSignerData.data.find(
            (signer: any) => signer.email?.trim().toLowerCase() === normalizedEmail
          );
          
          if (matchingSigner) {
            console.log("✅ Found exact email match signer:", matchingSigner.id, "-", matchingSigner.email);
            return matchingSigner.id;
          } else {
            console.log("⚠️ No exact email match found in results, will try to create");
          }
        }
      } catch (getError) {
        console.log("ℹ️ Initial search failed, will try to create");
      }
      
      // 2. Tentar criar novo signer
      console.log("➕ Creating new signer for:", email);
      try {
        const createSignerResponse = await makeAssinafyRequest(
          `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`,
          'POST',
          apiKey,
          {
            full_name: name,
            email: email, // Usa email original para criação
            government_id: cpf || undefined
          }
        );

        const signerData = await createSignerResponse.json();
        const newId = signerData.data?.id;
        if (newId) {
          console.log("✅ New signer created:", newId);
          return newId;
        }
      } catch (createError: any) {
        console.log("⚠️ Create failed:", createError.message);
        
        // 3. Se falhou porque já existe, buscar TODOS os signers e filtrar localmente
        if (createError.message?.includes("já existe") || createError.message?.includes("already exists")) {
          console.log("🔄 Signer already exists, fetching ALL signers to find exact match...");
          
          try {
            // Buscar com paginação maior - LISTAR TODOS
            const allSignersResponse = await makeAssinafyRequest(
              `https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers?per-page=200`,
              'GET',
              apiKey
            );
            
            const allSignersData = await allSignersResponse.json();
            console.log("📋 Total signers found:", allSignersData.data?.length || 0);
            
            if (allSignersData.data && allSignersData.data.length > 0) {
              // Buscar com normalização flexível
              const matchingSigner = allSignersData.data.find(
                (signer: any) => signer.email?.trim().toLowerCase() === normalizedEmail
              );
              
              if (matchingSigner) {
                console.log("✅ Found signer in full list:", matchingSigner.id, matchingSigner.email);
                return matchingSigner.id;
              }
              
              // Se ainda não achou, mostrar primeiros 10 emails para debug
              console.log("📧 First 10 signer emails:", 
                allSignersData.data.slice(0, 10).map((s: any) => s.email)
              );
            }
          } catch (listError) {
            console.error("❌ Failed to list all signers:", listError);
          }
          
          // Se não conseguiu resolver, lança erro com mais contexto
          throw new Error(`Não foi possível criar/encontrar assinante para: ${email}. Verifique se este email já está cadastrado com outra formatação no Assinafy.`);
        }
        
        throw createError;
      }
      
      throw new Error(`Falha ao obter/criar assinante para: ${email}`);
    };
    
    // Get or create signers for both client and company manager
    console.log("👤 Getting client signer...");
    const clientSignerId = await getOrCreateSigner(
      contractData.client_email, 
      contractData.client_name,
      contractData.client_cpf
    );
    
    // Get manager info from user profile
    console.log("🏢 Getting company manager signer...");
    let managerSignerId: string | null = null;
    let signerIds = [clientSignerId];
    
    if (supabaseClient && companyId) {
      try {
        // Get the current user's email (the one creating the contract)
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user?.email) {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', user.id)
            .single();
          
          const managerEmail = profile?.email || user.email;
          const managerName = profile?.full_name || 'Gestor';
          
          // Only add manager as signer if email is different from client
          if (managerEmail.toLowerCase() !== contractData.client_email.toLowerCase()) {
            console.log("✅ Manager has different email, adding as signer");
            managerSignerId = await getOrCreateSigner(managerEmail, managerName);
            signerIds.push(managerSignerId);
          } else {
            console.log("ℹ️ Manager and client have same email, skipping duplicate");
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not get manager info:", error);
      }
    }
    
    console.log("✅ Signers ready - Client:", clientSignerId, managerSignerId ? `Manager: ${managerSignerId}` : "(no manager)");

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
    const maxAttempts = 15; // 30 seconds max (15 x 2s)
    
    // Status that indicate document is ready for assignment
    const readyStatuses = ['pending_signature', 'ready', 'waiting_signatures', 'metadata_ready'];
    
    while (!documentReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
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
          console.log(`📊 Document status (attempt ${attempts}/${maxAttempts}): ${currentStatus}`);
          
          // Check if document is ready for assignment
          if (readyStatuses.includes(currentStatus)) {
            documentReady = true;
            console.log(`✅ Document is ready for assignment! Status: ${currentStatus}`);
          } else if (currentStatus === 'uploaded') {
            console.log(`⏳ Document uploaded but still processing... (attempt ${attempts}/${maxAttempts})`);
            // Continue waiting - DO NOT mark as ready!
          } else if (currentStatus === 'metadata_processing' || currentStatus === 'processing') {
            console.log(`⏳ Document still processing: ${currentStatus}`);
            // Continue waiting
          } else {
            console.warn(`⚠️ Unexpected document status: ${currentStatus}`);
            // Se já tentou pelo menos 5 vezes e status ainda é desconhecido, tentar assignment
            if (attempts >= 5) {
              console.log(`ℹ️ Proceeding with assignment after ${attempts} attempts with status: ${currentStatus}`);
              documentReady = true; // Forçar saída do loop
            }
          }
        }
      } catch (error) {
        console.error("❌ Error checking document status:", error);
      }
    }
    
    if (!documentReady) {
      console.warn("⚠️ Document processing timeout after 30s, will attempt assignment with retries...");
    }

    // Create assignment for signers with retry mechanism
    console.log("📝 Creating assignment for document:", documentId);
    console.log("📋 Signers:", signerIds.length === 1 ? "Client only" : "Client + Manager");
    
    let assignmentCreated = false;
    let assignmentAttempts = 0;
    const maxAssignmentAttempts = 3;
    let lastAssignmentError = '';
    
    while (!assignmentCreated && assignmentAttempts < maxAssignmentAttempts) {
      assignmentAttempts++;
      
      // Progressive wait between attempts: 0s, 3s, 6s
      if (assignmentAttempts > 1) {
        const waitTime = assignmentAttempts * 3000;
        console.log(`⏳ Assignment retry ${assignmentAttempts}, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const assignmentResponse = await makeAssinafyRequest(
        `https://api.assinafy.com.br/v1/documents/${documentId}/assignments`,
        'POST',
        apiKey,
        {
          signer_ids: signerIds,
          method: "virtual",
          message: `Contrato: ${contractData.title}`
        }
      );
      
      if (assignmentResponse.ok) {
        assignmentCreated = true;
        const assignmentData = await assignmentResponse.json();
        console.log("✅ Assignment created successfully!");
        console.log("📋 Assignment data:", JSON.stringify(assignmentData, null, 2));
        logData.response_data.assignment = assignmentData;
      } else {
        const errorText = await assignmentResponse.text();
        lastAssignmentError = errorText;
        console.warn(`⚠️ Assignment attempt ${assignmentAttempts}/${maxAssignmentAttempts} failed: ${errorText}`);
        
        // If error is not about 'uploaded' status, don't retry
        if (!errorText.includes("'uploaded' status") && !errorText.includes("uploaded")) {
          console.error("❌ Non-recoverable assignment error, stopping retries");
          logData.response_data.assignmentError = errorText;
          break;
        }
      }
    }
    
    if (!assignmentCreated && lastAssignmentError) {
      console.error("❌ All assignment attempts failed:", lastAssignmentError);
      logData.response_data.assignmentError = lastAssignmentError;
    }

    // Prepare signing URL
    const signingUrl = `https://app.assinafy.com.br/sign/${documentId}`;
    console.log("🔗 Signing URL:", signingUrl);
    
    logData.response_data.final = {
      document_id: documentId,
      signer_id: clientSignerId,
      ...(managerSignerId && { manager_signer_id: managerSignerId }),
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

    // Update contract directly in edge function (more reliable than frontend)
    if (supabaseClient && contractId) {
      console.log("📝 Updating contract with document data...");
      const { error: contractUpdateError } = await supabaseClient
        .from('contracts')
        .update({
          assinafy_document_id: documentId,
          document_url: signingUrl,
          signature_status: 'sent'
        })
        .eq('id', contractId);
      
      if (contractUpdateError) {
        console.error("❌ Failed to update contract:", contractUpdateError);
        // Don't fail the operation, just log the error
      } else {
        console.log("✅ Contract updated successfully with Assinafy data");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        signer_id: clientSignerId,
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

async function syncDocumentStatus(apiKey: string, documentId: string, supabaseClient: any): Promise<Response> {
  try {
    console.log("📥 Fetching document status from Assinafy for:", documentId);
    
    // Get document details from Assinafy
    const response = await makeAssinafyRequest(
      `https://api.assinafy.com.br/v1/documents/${documentId}`,
      'GET',
      apiKey
    );

    const documentData = await response.json();
    const doc = documentData.data;
    
    console.log("📄 Document status from Assinafy:", doc.status);

    // Check if document is signed/certificated
    const completionStatuses = ["certificated", "completed", "signed"];
    const isSigned = completionStatuses.includes(doc.status);
    
    // Fetch current contract status BEFORE updating to avoid duplicate notifications
    const { data: currentContract } = await supabaseClient
      .from('contracts')
      .select('id, signature_status')
      .eq('assinafy_document_id', documentId)
      .single();

    const wasAlreadySigned = currentContract?.signature_status === 'signed';
    console.log("📋 Current contract status:", currentContract?.signature_status, "| Was already signed:", wasAlreadySigned);
    
    const updateData: any = {};

    if (isSigned) {
      updateData.signature_status = 'signed';
      updateData.signed_at = doc.updated_at || new Date().toISOString();
      
      if (doc.artifacts?.certificated) {
        updateData.document_url = doc.artifacts.certificated;
      }
      
      console.log("✅ Document is signed, updating to:", updateData);
    } else {
      updateData.signature_status = 'pending';
      console.log("ℹ️ Document is pending, status:", doc.status);
    }

    // Update contract in database
    const { data, error } = await supabaseClient
      .from('contracts')
      .update(updateData)
      .eq('assinafy_document_id', documentId)
      .select('id, signature_status, signed_at');

    if (error) {
      console.error("❌ Error updating contract:", error);
      throw new Error(`Erro ao atualizar contrato: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ No contract found with document_id:", documentId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Contrato não encontrado com este document_id' 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Contract updated successfully:", data);

    // Send WhatsApp notification ONLY if status changed from non-signed to signed
    // This prevents duplicate notifications when webhook already sent one
    if (isSigned && !wasAlreadySigned && data && data.length > 0) {
      console.log("📲 Status changed to signed, sending WhatsApp notification...");
      const contractId = data[0].id;
      
      // Fetch full contract data for notification
      const { data: contractData } = await supabaseClient
        .from('contracts')
        .select('company_id, client_id')
        .eq('id', contractId)
        .single();

      if (contractData) {
        await sendWhatsAppNotificationToClient(supabaseClient, contractData, documentId);
      }
    } else if (isSigned && wasAlreadySigned) {
      console.log("ℹ️ Contract was already signed, skipping notification (already sent by webhook)");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: isSigned ? 'signed' : 'pending',
        document_status: doc.status,
        updated: data[0]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Sync status error:", error);
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
    doc.text(contractData.company_name || '[Nome da Empresa]', 145, yPosition + 6, { align: 'center' });
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

async function downloadDocument(apiKey: string, documentId: string): Promise<Response> {
  try {
    console.log("📥 Downloading certificated document:", documentId);
    
    if (!documentId) {
      throw new Error("Document ID é obrigatório");
    }
    
    // Fazer request autenticado para a API do Assinafy para baixar o documento certificado
    const response = await fetch(
      `https://api.assinafy.com.br/v1/documents/${documentId}/download/certificated`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    console.log("📥 Assinafy download response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error downloading document:", errorText);
      throw new Error(`Erro ao baixar documento: ${response.status} - ${errorText}`);
    }
    
    // Converter o PDF para base64 para enviar via JSON
    const pdfBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    
    // Converter para base64
    let binary = '';
    for (let i = 0; i < pdfBytes.byteLength; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);
    
    console.log("✅ Document downloaded successfully, size:", pdfBytes.byteLength, "bytes");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfBase64: pdfBase64,
        contentType: 'application/pdf'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error in downloadDocument:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Função para enviar notificação WhatsApp apenas para o cliente quando contrato é assinado
async function sendWhatsAppNotificationToClient(
  supabase: any, 
  contract: { company_id: string; client_id: string },
  documentId: string
) {
  try {
    console.log("[assinafy-integration] 📱 Sending WhatsApp notification to client for document:", documentId);
    
    // Buscar configurações do WhatsApp da empresa
    const { data: whatsappSettings } = await supabase
      .from("whatsapp_settings")
      .select("instance_url, instance_name, api_token, is_active, connection_status")
      .eq("company_id", contract.company_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!whatsappSettings) {
      console.log("[assinafy-integration] ⚠️ WhatsApp not configured for company:", contract.company_id);
      return;
    }

    if (whatsappSettings.connection_status !== 'connected') {
      console.log("[assinafy-integration] ⚠️ WhatsApp not connected for company:", contract.company_id);
      return;
    }

    console.log("[assinafy-integration] ✅ WhatsApp configured and connected");

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone")
      .eq("id", contract.client_id)
      .single();

    if (client && client.phone) {
      const clientMessage = `✅ Parabéns ${client.name}!\n\nSeu contrato foi assinado com sucesso! 🎉\n\nVocê receberá uma cópia do documento assinado em breve.\n\nObrigado pela confiança!`;
      
      try {
        await supabase.functions.invoke('whatsapp-evolution', {
          body: {
            action: 'send_message',
            instance_url: whatsappSettings.instance_url,
            api_token: whatsappSettings.api_token,
            instance_name: whatsappSettings.instance_name,
            phone_number: client.phone,
            message: clientMessage,
            company_id: contract.company_id,
            client_id: contract.client_id
          }
        });
        console.log("[assinafy-integration] ✅ WhatsApp sent to client:", client.phone);
      } catch (whatsappError) {
        console.error("[assinafy-integration] ❌ WhatsApp error:", whatsappError);
      }
    } else {
      console.log("[assinafy-integration] ⚠️ Client has no phone:", contract.client_id);
    }
  } catch (error) {
    console.error("[assinafy-integration] ❌ Error sending WhatsApp notification:", error);
  }
}
