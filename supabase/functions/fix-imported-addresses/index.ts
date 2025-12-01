import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Buscar company_id do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    console.log('Buscando clientes com endereço em formato texto para empresa:', profile.company_id)

    // Buscar todos os clientes da empresa
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', profile.company_id)

    if (clientsError) {
      throw clientsError
    }

    console.log(`Total de clientes encontrados: ${clients.length}`)

    let fixedCount = 0
    let errors: string[] = []

    for (const client of clients) {
      if (!client.address) continue

      // Verificar se já é JSON válido
      try {
        JSON.parse(client.address)
        continue // Já está no formato correto
      } catch {
        // Não é JSON, vamos converter
      }

      try {
        console.log(`Processando cliente ${client.name} - endereço:`, client.address)
        
        // Parse do endereço tipo: "Estrada São Domingos Sávio, nº 766, Santa Cruz, 11642/RJ, CEP: 23525033"
        const addressParts = client.address.split(',').map((part: string) => part.trim())
        
        let street = ''
        let number = ''
        let complement = ''
        let neighborhood = ''
        let city = ''
        let state = ''
        let cep = ''

        // Extrair CEP (última parte com "CEP:")
        const cepPart = addressParts.find((part: string) => part.includes('CEP:'))
        if (cepPart) {
          cep = cepPart.replace('CEP:', '').trim().replace(/(\d{5})(\d{3})/, '$1-$2')
        }

        // Extrair cidade/estado (penúltima parte com formato "codigo/UF")
        const cityStatePart = addressParts.find((part: string) => /\d+\/[A-Z]{2}/.test(part))
        if (cityStatePart) {
          const match = cityStatePart.match(/(\d+)\/([A-Z]{2})/)
          if (match) {
            state = match[2]
            // Cidade fica vazia (é código IBGE)
          }
        }

        // Primeira parte é a rua (pode conter "nº")
        if (addressParts[0]) {
          const firstPart = addressParts[0]
          if (firstPart.includes('nº')) {
            const [streetPart, numPart] = firstPart.split('nº')
            street = streetPart.trim()
            number = numPart.trim()
          } else {
            street = firstPart
          }
        }

        // Segunda parte pode ser número (se não foi extraído acima)
        if (!number && addressParts[1] && /nº\s*\d+/.test(addressParts[1])) {
          number = addressParts[1].replace('nº', '').trim()
        }

        // Bairro é geralmente a penúltima ou antepenúltima parte válida
        const validParts = addressParts.filter((part: string) => 
          part && 
          !part.includes('CEP:') && 
          !part.includes('nº') &&
          !/\d+\/[A-Z]{2}/.test(part)
        )
        
        if (validParts.length > 0) {
          neighborhood = validParts[validParts.length - 1]
        }

        // Criar objeto de endereço estruturado
        const addressObj = {
          cep,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        }

        console.log(`Endereço convertido para ${client.name}:`, addressObj)

        // Atualizar cliente com endereço em formato JSON
        const { error: updateError } = await supabase
          .from('clients')
          .update({ address: JSON.stringify(addressObj) })
          .eq('id', client.id)

        if (updateError) {
          errors.push(`${client.name}: ${updateError.message}`)
          console.error(`Erro ao atualizar ${client.name}:`, updateError)
        } else {
          fixedCount++
          console.log(`✓ Cliente ${client.name} atualizado com sucesso`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${client.name}: ${errorMsg}`)
        console.error(`Erro ao processar ${client.name}:`, error)
      }
    }

    console.log(`Correção concluída: ${fixedCount} endereços corrigidos`)

    return new Response(
      JSON.stringify({
        success: true,
        fixedCount,
        totalClients: clients.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in fix-imported-addresses:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
