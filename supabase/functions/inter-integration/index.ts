import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InterSettings {
  client_id_encrypted: string;
  client_secret_encrypted: string;
  certificate_base64?: string;
  is_sandbox: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, company_id, ...params } = await req.json();
    console.log("Inter Integration - Action:", action, "Company:", company_id);

    // Helper function to get or decrypt credentials
    const getSettings = async (): Promise<InterSettings | null> => {
      const { data: settings } = await supabaseClient
        .from("inter_settings")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!settings) return null;

      // Decrypt credentials
      const { data: clientIdData } = await supabaseClient.rpc("decrypt_inter_credential", {
        p_encrypted_credential: settings.client_id_encrypted,
      });
      const { data: clientSecretData } = await supabaseClient.rpc("decrypt_inter_credential", {
        p_encrypted_credential: settings.client_secret_encrypted,
      });

      return {
        ...settings,
        client_id_encrypted: clientIdData,
        client_secret_encrypted: clientSecretData,
      };
    };

    // Helper function to get OAuth token
    const getAccessToken = async (settings: InterSettings): Promise<string> => {
      const baseUrl = settings.is_sandbox
        ? "https://cdpj.partners.bancointer.com.br"
        : "https://cdpj.partners.bancointer.com.br";

      const credentials = btoa(`${settings.client_id_encrypted}:${settings.client_secret_encrypted}`);

      const response = await fetch(`${baseUrl}/oauth/v2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          client_id: settings.client_id_encrypted,
          client_secret: settings.client_secret_encrypted,
          grant_type: "client_credentials",
          scope: "boleto-cobranca.read boleto-cobranca.write cob.read cob.write",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro na autenticação: ${error}`);
      }

      const data = await response.json();
      return data.access_token;
    };

    // Log operation
    const logOperation = async (operationType: string, status: string, requestData: any, responseData: any, errorMessage?: string) => {
      await supabaseClient.from("inter_logs").insert({
        company_id,
        operation_type: operationType,
        status,
        request_data: requestData,
        response_data: responseData,
        error_message: errorMessage,
      });
    };

    switch (action) {
      case "save_settings": {
        const { client_id, client_secret, certificate, is_sandbox } = params;

        // Encrypt credentials
        const { data: encryptedClientId } = await supabaseClient.rpc("encrypt_inter_credential", {
          p_credential: client_id,
        });
        const { data: encryptedClientSecret } = await supabaseClient.rpc("encrypt_inter_credential", {
          p_credential: client_secret,
        });

        const { error } = await supabaseClient.from("inter_settings").upsert({
          company_id,
          client_id_encrypted: encryptedClientId,
          client_secret_encrypted: encryptedClientSecret,
          certificate_base64: certificate || null,
          is_sandbox: is_sandbox ?? true,
          is_active: true,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        await logOperation("save_settings", "success", { is_sandbox }, { success: true });

        return new Response(
          JSON.stringify({ success: true, message: "Configurações salvas com sucesso" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "test_connection": {
        let settings: InterSettings | null = null;

        // Use provided credentials or load from database
        if (params.client_id && params.client_secret) {
          settings = {
            client_id_encrypted: params.client_id,
            client_secret_encrypted: params.client_secret,
            certificate_base64: params.certificate,
            is_sandbox: params.is_sandbox ?? true,
          };
        } else {
          settings = await getSettings();
        }

        if (!settings) {
          return new Response(
            JSON.stringify({ success: false, error: "Configurações não encontradas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const accessToken = await getAccessToken(settings);
          
          // Update test result
          await supabaseClient.from("inter_settings").update({
            last_test_at: new Date().toISOString(),
            test_result: { success: true, tested_at: new Date().toISOString() },
          }).eq("company_id", company_id);

          await logOperation("test_connection", "success", {}, { token_obtained: true });

          return new Response(
            JSON.stringify({
              success: true,
              message: "Conexão estabelecida com sucesso",
              data: { token_obtained: true },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error: any) {
          await logOperation("test_connection", "error", {}, {}, error.message);

          return new Response(
            JSON.stringify({
              success: false,
              error: error.message,
              message: "Falha na conexão. Verifique suas credenciais.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "create_charge": {
        const settings = await getSettings();
        if (!settings) throw new Error("Configurações não encontradas");

        const accessToken = await getAccessToken(settings);
        const baseUrl = settings.is_sandbox
          ? "https://cdpj.partners.bancointer.com.br"
          : "https://cdpj.partners.bancointer.com.br";

        const response = await fetch(`${baseUrl}/cobranca/v3/cobrancas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(params.charge_data),
        });

        const data = await response.json();

        if (!response.ok) {
          await logOperation("create_charge", "error", params.charge_data, data, data.message);
          throw new Error(data.message || "Erro ao criar cobrança");
        }

        await logOperation("create_charge", "success", params.charge_data, data);

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_charge": {
        const settings = await getSettings();
        if (!settings) throw new Error("Configurações não encontradas");

        const accessToken = await getAccessToken(settings);
        const baseUrl = settings.is_sandbox
          ? "https://cdpj.partners.bancointer.com.br"
          : "https://cdpj.partners.bancointer.com.br";

        const response = await fetch(
          `${baseUrl}/cobranca/v3/cobrancas/${params.nosso_numero}`,
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          await logOperation("get_charge", "error", { nosso_numero: params.nosso_numero }, data);
          throw new Error(data.message || "Erro ao consultar cobrança");
        }

        await logOperation("get_charge", "success", { nosso_numero: params.nosso_numero }, data);

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_charge": {
        const settings = await getSettings();
        if (!settings) throw new Error("Configurações não encontradas");

        const accessToken = await getAccessToken(settings);
        const baseUrl = settings.is_sandbox
          ? "https://cdpj.partners.bancointer.com.br"
          : "https://cdpj.partners.bancointer.com.br";

        const response = await fetch(
          `${baseUrl}/cobranca/v3/cobrancas/${params.nosso_numero}/cancelar`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ motivoCancelamento: params.motivo }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          await logOperation("cancel_charge", "error", params, data);
          throw new Error(data.message || "Erro ao cancelar cobrança");
        }

        await logOperation("cancel_charge", "success", params, data);

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_pix_charge": {
        const settings = await getSettings();
        if (!settings) throw new Error("Configurações não encontradas");

        const accessToken = await getAccessToken(settings);
        const baseUrl = settings.is_sandbox
          ? "https://cdpj.partners.bancointer.com.br"
          : "https://cdpj.partners.bancointer.com.br";

        const txid = Math.random().toString(36).substring(2, 37); // Generate 35 char txid

        const response = await fetch(`${baseUrl}/pix/v2/cob/${txid}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(params.pix_data),
        });

        const data = await response.json();

        if (!response.ok) {
          await logOperation("create_pix_charge", "error", params.pix_data, data);
          throw new Error(data.message || "Erro ao criar cobrança PIX");
        }

        await logOperation("create_pix_charge", "success", params.pix_data, data);

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: any) {
    console.error("Erro na integração Inter:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro desconhecido",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
