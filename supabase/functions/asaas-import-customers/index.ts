import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_BASE = 'https://api.asaas.com/v3'
const ASAAS_SANDBOX_BASE = 'https://api-sandbox.asaas.com/v3'

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufToBase64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAesKey(secret: string) {
  const secretBytes = textEncoder.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', secretBytes);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function decryptTokenLocal(encrypted: string, secret: string) {
  const data = new Uint8Array(base64ToBuf(encrypted));
  const iv = data.slice(0, 12);
  const cipher = data.slice(12);
  const key = await getAesKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return textDecoder.decode(plain);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verificar autenticação
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    // Buscar empresa do usuário
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.company_id) {
      throw new Error('Empresa não encontrada')
    }

    const companyId = profile.company_id

    console.log('Iniciando importação de clientes do Asaas para empresa:', companyId)

    // Buscar configurações Asaas
    const { data: settings } = await supabaseClient
      .from('asaas_settings')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle()

    if (!settings) {
      throw new Error('Configurações do Asaas não encontradas')
    }

    const key = Deno.env.get('ASAAS_ENCRYPTION_KEY') ?? Deno.env.get('EVOLUTION_ENCRYPTION_KEY')
    if (!key) {
      throw new Error('Chave de criptografia ausente')
    }

    const decryptedToken = await decryptTokenLocal(settings.api_token_encrypted, key)
    const baseUrl = settings.is_sandbox ? ASAAS_SANDBOX_BASE : ASAAS_API_BASE

    // Listar TODOS os clientes do Asaas com paginação
    const allAsaasCustomers = []
    let offset = 0
    const limit = 100

    console.log('Buscando clientes do Asaas...')

    while (true) {
      const response = await fetch(`${baseUrl}/customers?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
          'access_token': decryptedToken,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('Erro ao buscar clientes:', error)
        throw new Error(`Erro ao buscar clientes do Asaas: ${response.status}`)
      }

      const result = await response.json()
      const customers = result.data || []
      
      allAsaasCustomers.push(...customers)
      console.log(`Buscados ${customers.length} clientes (offset: ${offset})`)

      if (customers.length < limit || !result.hasMore) {
        break
      }

      offset += limit
    }

    console.log(`Total de clientes encontrados no Asaas: ${allAsaasCustomers.length}`)

    // Processar cada cliente
    const imported = []
    const duplicates = []
    const errors = []

    for (const asaasCustomer of allAsaasCustomers) {
      try {
        // Verificar se já existe por CPF/CNPJ
        if (asaasCustomer.cpfCnpj) {
          const { data: existingClient } = await supabaseClient
            .from('clients')
            .select('id, name')
            .eq('company_id', companyId)
            .eq('document', asaasCustomer.cpfCnpj)
            .maybeSingle()

          if (existingClient) {
            duplicates.push(asaasCustomer.name)
            continue
          }
        }

        // Montar endereço completo
        let fullAddress = ''
        if (asaasCustomer.address) {
          const parts = []
          if (asaasCustomer.address) parts.push(asaasCustomer.address)
          if (asaasCustomer.addressNumber) parts.push(`nº ${asaasCustomer.addressNumber}`)
          if (asaasCustomer.complement) parts.push(asaasCustomer.complement)
          if (asaasCustomer.province) parts.push(asaasCustomer.province)
          if (asaasCustomer.city && asaasCustomer.state) {
            parts.push(`${asaasCustomer.city}/${asaasCustomer.state}`)
          }
          if (asaasCustomer.postalCode) parts.push(`CEP: ${asaasCustomer.postalCode}`)
          fullAddress = parts.join(', ')
        }

        // Inserir cliente
        const { error: insertError } = await supabaseClient
          .from('clients')
          .insert({
            company_id: companyId,
            name: asaasCustomer.name,
            email: asaasCustomer.email || null,
            phone: asaasCustomer.mobilePhone || asaasCustomer.phone || 'Não informado',
            document: asaasCustomer.cpfCnpj || null,
            address: fullAddress || null,
            status: 'active'
          })

        if (insertError) {
          console.error('Erro ao inserir cliente:', asaasCustomer.name, insertError)
          errors.push({ name: asaasCustomer.name, error: insertError.message })
        } else {
          imported.push(asaasCustomer.name)
        }

      } catch (error) {
        console.error('Erro ao processar cliente:', asaasCustomer.name, error)
        errors.push({ 
          name: asaasCustomer.name, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    console.log('Importação concluída:', {
      total: allAsaasCustomers.length,
      imported: imported.length,
      duplicates: duplicates.length,
      errors: errors.length
    })

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_asaas: allAsaasCustomers.length,
          imported: imported.length,
          duplicates: duplicates.length,
          errors: errors.length
        },
        imported_clients: imported,
        duplicate_clients: duplicates,
        error_details: errors
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro na importação:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
