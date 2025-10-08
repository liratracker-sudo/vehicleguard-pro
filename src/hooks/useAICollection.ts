import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AICollectionSettings {
  id: string;
  company_id: string;
  is_active: boolean;
  openai_model: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface AIWeeklyReport {
  id: string;
  company_id: string;
  is_active: boolean;
  manager_phones: string[] | null;
  schedule_day: number;
  schedule_time: string;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAICollection() {
  const [settings, setSettings] = useState<AICollectionSettings | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<AIWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      // Carregar configurações de IA
      const { data: aiSettings, error: settingsError } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      setSettings(aiSettings);

      // Carregar configurações de relatório semanal
      const { data: reportSettings, error: reportError } = await supabase
        .from('ai_weekly_reports')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (reportError) throw reportError;
      
      setWeeklyReport(reportSettings);

    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (data: Partial<AICollectionSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      if (settings?.id) {
        // Atualizar existente
        const { error } = await supabase
          .from('ai_collection_settings')
          .update(data)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase
          .from('ai_collection_settings')
          .insert({
            ...data,
            company_id: profile.company_id
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso"
      });

      await loadSettings();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const saveWeeklyReport = async (data: Partial<AIWeeklyReport>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      if (weeklyReport?.id) {
        // Atualizar existente
        const { error } = await supabase
          .from('ai_weekly_reports')
          .update(data)
          .eq('id', weeklyReport.id);

        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase
          .from('ai_weekly_reports')
          .insert({
            ...data,
            company_id: profile.company_id
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações de relatório salvas"
      });

      await loadSettings();
    } catch (error: any) {
      console.error('Erro ao salvar relatório:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const processOverdueClients = async () => {
    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      const { data, error } = await supabase.functions.invoke('ai-collection', {
        body: {
          action: 'process_overdue_clients',
          company_id: profile.company_id
        }
      });

      if (error) throw error;

      toast({
        title: "Processamento Concluído",
        description: `${data.processed} clientes processados com sucesso`
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao processar clientes:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const generateWeeklyReport = async () => {
    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      const { data, error } = await supabase.functions.invoke('ai-collection', {
        body: {
          action: 'generate_weekly_report',
          company_id: profile.company_id
        }
      });

      if (error) throw error;

      toast({
        title: "Relatório Gerado",
        description: "Relatório semanal enviado com sucesso"
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    weeklyReport,
    loading,
    processing,
    loadSettings,
    saveSettings,
    saveWeeklyReport,
    processOverdueClients,
    generateWeeklyReport
  };
}