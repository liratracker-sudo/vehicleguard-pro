import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InterSettings {
  id: string;
  company_id: string;
  is_sandbox: boolean;
  is_active: boolean;
  last_test_at: string | null;
  test_result: any;
}

interface InterCharge {
  nossoNumero: string;
  seuNumero: string;
  valorNominal: number;
  valorAbatimento?: number;
  dataVencimento: string;
  numDiasAgenda: number;
  pagador: {
    cpfCnpj: string;
    tipoPessoa: "FISICA" | "JURIDICA";
    nome: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  mensagem?: {
    linha1?: string;
    linha2?: string;
    linha3?: string;
    linha4?: string;
    linha5?: string;
  };
  desconto1?: {
    codigoDesconto: string;
    taxa: number;
    valor: number;
    data: string;
  };
  multa?: {
    codigoMulta: string;
    taxa: number;
    valor: number;
    data: string;
  };
  mora?: {
    codigoMora: string;
    taxa: number;
    valor: number;
  };
}

export function useInter() {
  const [settings, setSettings] = useState<InterSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data } = await supabase
        .from("inter_settings")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .maybeSingle();

      setSettings(data);
    } catch (error) {
      console.error("Erro ao carregar configurações Inter:", error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const createCharge = async (chargeData: InterCharge) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "create_charge",
          company_id: profile.company_id,
          charge_data: chargeData,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao criar cobrança");
      }

      toast.success("Cobrança criada com sucesso!");
      return data.data;
    } catch (error: any) {
      console.error("Erro ao criar cobrança:", error);
      toast.error(error.message || "Erro ao criar cobrança");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCharge = async (nossoNumero: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "get_charge",
          company_id: profile.company_id,
          nosso_numero: nossoNumero,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao consultar cobrança");
      }

      return data.data;
    } catch (error: any) {
      console.error("Erro ao consultar cobrança:", error);
      toast.error(error.message || "Erro ao consultar cobrança");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelCharge = async (nossoNumero: string, motivoCancelamento: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "cancel_charge",
          company_id: profile.company_id,
          nosso_numero: nossoNumero,
          motivo: motivoCancelamento,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao cancelar cobrança");
      }

      toast.success("Cobrança cancelada com sucesso!");
      return data.data;
    } catch (error: any) {
      console.error("Erro ao cancelar cobrança:", error);
      toast.error(error.message || "Erro ao cancelar cobrança");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createPixCharge = async (pixData: {
    calendario: {
      expiracao: number;
    };
    devedor: {
      cpf?: string;
      cnpj?: string;
      nome: string;
    };
    valor: {
      original: string;
    };
    chave: string;
    solicitacaoPagador?: string;
  }) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await supabase.functions.invoke("inter-integration", {
        body: {
          action: "create_pix_charge",
          company_id: profile.company_id,
          pix_data: pixData,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao criar cobrança PIX");
      }

      toast.success("Cobrança PIX criada com sucesso!");
      return data.data;
    } catch (error: any) {
      console.error("Erro ao criar cobrança PIX:", error);
      toast.error(error.message || "Erro ao criar cobrança PIX");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    loadSettings,
    createCharge,
    getCharge,
    cancelCharge,
    createPixCharge,
  };
}
