import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GERENCIANET_ENCRYPTION_KEY = Deno.env.get('GERENCIANET_ENCRYPTION_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log('Gerencianet Integration - Action:', action);

    // Definir chave de criptografia
    await supabase.rpc('set_encryption_key_guc', { p_key: GERENCIANET_ENCRYPTION_KEY });

    switch (action) {
      case 'save_settings':
        return await saveSettings(supabase, params);
      case 'create_boleto':
        return await createBoleto(supabase, params);
      case 'get_boleto':
        return await getBoleto(supabase, params);
      case 'test_credentials':
        return await testCredentials(supabase, params);
      case 'cancel_boleto':
        return await cancelBoleto(supabase, params);
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Erro na integração Gerencianet:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Salvar configurações
 */
async function saveSettings(supabase: any, params: any) {
  const { company_id, client_id, client_secret, is_sandbox } = params;

  try {
    // Criptografar credenciais
    const { data: encryptedClientId } = await supabase.rpc('encrypt_gerencianet_credential', {
      p_credential: client_id
    });

    const { data: encryptedClientSecret } = await supabase.rpc('encrypt_gerencianet_credential', {
      p_credential: client_secret
    });

    if (!encryptedClientId || !encryptedClientSecret) {
      throw new Error('Erro ao criptografar credenciais');
    }

    // Verificar se já existe configuração
    const { data: existing } = await supabase
      .from('gerencianet_settings')
      .select('id')
      .eq('company_id', company_id)
      .maybeSingle();

    if (existing) {
      // Atualizar
      const { error } = await supabase
        .from('gerencianet_settings')
        .update({
          client_id_encrypted: encryptedClientId,
          client_secret_encrypted: encryptedClientSecret,
          is_sandbox,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Criar novo
      const { error } = await supabase
        .from('gerencianet_settings')
        .insert({
          company_id,
          client_id_encrypted: encryptedClientId,
          client_secret_encrypted: encryptedClientSecret,
          is_sandbox,
          is_active: true
        });

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Configurações salvas com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao salvar configurações' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Obter token de autenticação OAuth2
 */
async function getAccessToken(
  clientId: string,
  clientSecret: string,
  isSandbox: boolean
): Promise<string> {
  const baseUrl = isSandbox 
    ? 'https://cobrancas-h.api.efipay.com.br'
    : 'https://cobrancas.api.efipay.com.br';

  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${baseUrl}/v1/authorize`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ grant_type: 'client_credentials' })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro na autenticação: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Criar boleto bancário
 */
async function createBoleto(supabase: any, params: any) {
  const { company_id, payment_id } = params;

  try {
    // Buscar configurações da Gerencianet
    const { data: settings, error: settingsError } = await supabase
      .from('gerencianet_settings')
      .select('client_id_encrypted, client_secret_encrypted, is_sandbox, is_active')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Configurações da Gerencianet não encontradas ou inativas');
    }

    // Descriptografar credenciais
    const { data: clientId } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_id_encrypted
    });

    const { data: clientSecret } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_secret_encrypted
    });

    if (!clientId || !clientSecret) {
      throw new Error('Erro ao descriptografar credenciais');
    }

    // Buscar dados do pagamento
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        clients:client_id (
          name,
          email,
          phone,
          document,
          address
        )
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error('Pagamento não encontrado');
    }

    // Obter access token
    const accessToken = await getAccessToken(clientId, clientSecret, settings.is_sandbox);

    // Preparar dados do boleto
    const boletoData = {
      items: [
        {
          name: 'Cobrança',
          value: Math.round(Number(payment.amount) * 100), // Converter para centavos
          amount: 1
        }
      ],
      payment: {
        banking_billet: {
          customer: {
            name: payment.clients.name,
            email: payment.clients.email || 'noreply@example.com',
            phone_number: payment.clients.phone?.replace(/\D/g, '').substring(0, 11),
            cpf: payment.clients.document?.replace(/\D/g, ''),
            address: {
              street: 'Rua Principal',
              number: '100',
              neighborhood: 'Centro',
              zipcode: '00000000',
              city: 'São Paulo',
              state: 'SP',
              complement: ''
            }
          },
          expire_at: payment.due_date,
          configurations: {
            fine: 200, // 2%
            interest: 33 // 0.33% ao dia (1% ao mês)
          },
          message: 'Cobrança referente aos serviços prestados'
        }
      }
    };

    const baseUrl = settings.is_sandbox
      ? 'https://cobrancas-h.api.efipay.com.br'
      : 'https://cobrancas.api.efipay.com.br';

    // Criar boleto
    const response = await fetch(`${baseUrl}/v1/charge/one-step`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(boletoData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao criar boleto: ${JSON.stringify(error)}`);
    }

    const boleto = await response.json();

    // Atualizar payment_transaction com dados do boleto
    await supabase
      .from('payment_transactions')
      .update({
        external_id: boleto.data.charge_id.toString(),
        barcode: boleto.data.barcode,
        payment_url: boleto.data.link,
        pix_code: boleto.data.pix?.qrcode || null,
        payment_gateway: 'gerencianet'
      })
      .eq('id', payment_id);

    // Registrar log
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'create_boleto',
      request_data: boletoData,
      response_data: boleto,
      status: 'success'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        charge_id: boleto.data.charge_id,
        barcode: boleto.data.barcode,
        link: boleto.data.link,
        pix: boleto.data.pix
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Registrar log de erro
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'create_boleto',
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Consultar boleto
 */
async function getBoleto(supabase: any, params: any) {
  const { company_id, charge_id } = params;

  try {
    // Buscar configurações
    const { data: settings } = await supabase
      .from('gerencianet_settings')
      .select('client_id_encrypted, client_secret_encrypted, is_sandbox')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .single();

    if (!settings) {
      throw new Error('Configurações não encontradas');
    }

    // Descriptografar credenciais
    const { data: clientId } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_id_encrypted
    });

    const { data: clientSecret } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_secret_encrypted
    });

    const accessToken = await getAccessToken(clientId, clientSecret, settings.is_sandbox);

    const baseUrl = settings.is_sandbox
      ? 'https://cobrancas-h.api.efipay.com.br'
      : 'https://cobrancas.api.efipay.com.br';

    const response = await fetch(`${baseUrl}/v1/charge/${charge_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao consultar boleto: ${JSON.stringify(error)}`);
    }

    const boleto = await response.json();

    // Registrar log
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'get_boleto',
      response_data: boleto,
      status: 'success'
    });

    return new Response(
      JSON.stringify({ success: true, data: boleto }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'get_boleto',
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Testar credenciais
 */
async function testCredentials(supabase: any, params: any) {
  const { company_id, client_id, client_secret, is_sandbox } = params;

  try {
    const accessToken = await getAccessToken(client_id, client_secret, is_sandbox);

    const baseUrl = is_sandbox
      ? 'https://cobrancas-h.api.efipay.com.br'
      : 'https://cobrancas.api.efipay.com.br';

    // Fazer uma requisição de teste
    const response = await fetch(`${baseUrl}/v1/charge`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const success = response.ok;

    // Atualizar configurações com resultado do teste
    await supabase
      .from('gerencianet_settings')
      .update({
        last_test_at: new Date().toISOString(),
        test_result: { 
          success, 
          status: response.status,
          message: success ? 'Credenciais válidas' : 'Falha na autenticação'
        }
      })
      .eq('company_id', company_id);

    // Registrar log
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'test_credentials',
      status: success ? 'success' : 'error',
      response_data: { success, status: response.status }
    });

    return new Response(
      JSON.stringify({ 
        success,
        message: success ? 'Credenciais válidas' : 'Falha na autenticação'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'test_credentials',
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao testar credenciais'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Cancelar boleto
 */
async function cancelBoleto(supabase: any, params: any) {
  const { company_id, charge_id } = params;

  try {
    // Buscar configurações
    const { data: settings } = await supabase
      .from('gerencianet_settings')
      .select('client_id_encrypted, client_secret_encrypted, is_sandbox')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .single();

    if (!settings) {
      throw new Error('Configurações não encontradas');
    }

    // Descriptografar credenciais
    const { data: clientId } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_id_encrypted
    });

    const { data: clientSecret } = await supabase.rpc('decrypt_gerencianet_credential', {
      p_encrypted_credential: settings.client_secret_encrypted
    });

    const accessToken = await getAccessToken(clientId, clientSecret, settings.is_sandbox);

    const baseUrl = settings.is_sandbox
      ? 'https://cobrancas-h.api.efipay.com.br'
      : 'https://cobrancas.api.efipay.com.br';

    const response = await fetch(`${baseUrl}/v1/charge/${charge_id}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao cancelar boleto: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    // Registrar log
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'cancel_boleto',
      response_data: result,
      status: 'success'
    });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    await supabase.from('gerencianet_logs').insert({
      company_id,
      operation_type: 'cancel_boleto',
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}
