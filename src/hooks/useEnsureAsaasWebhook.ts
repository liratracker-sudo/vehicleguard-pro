import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Ensures Asaas webhook is configured for the current company.
 * Runs once per app session. If settings exist and webhook isn't configured,
 * it will automatically call the asaas-integration edge function to register it.
 */
export function useEnsureAsaasWebhook() {
  const { toast } = useToast();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const ensure = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile?.company_id) return;

        const { data: settings } = await supabase
          .from('asaas_settings')
          .select('id, is_active')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .maybeSingle();

        if (!settings) return; // Asaas not configured for this company

        // Webhook não disponível após restauração - desabilitado
        console.log('Webhook Asaas não configurado (colunas não existem após restauração)');
        return;
      } catch (err: any) {
        // Silencioso para não atrapalhar o fluxo; logar para diagnóstico
        console.error('useEnsureAsaasWebhook error:', err);
      }
    };

    ensure();
  }, [toast]);
}
