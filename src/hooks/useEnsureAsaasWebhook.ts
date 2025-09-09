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
          .select('id, webhook_id, webhook_enabled, is_active')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .maybeSingle();

        if (!settings) return; // Asaas not configured for this company

        if (!settings.webhook_id || settings.webhook_enabled === false) {
          const resp = await supabase.functions.invoke('asaas-integration', {
            body: { action: 'setup_webhook' }
          });

          if (resp.error || !resp.data?.success) {
            throw new Error(resp.error?.message || resp.data?.message || 'Falha ao configurar webhook');
          }

          toast({
            title: 'Webhook Asaas configurado',
            description: 'Atualizações de pagamento agora serão recebidas em tempo real.',
          });
        }
      } catch (err: any) {
        // Silencioso para não atrapalhar o fluxo; logar para diagnóstico
        console.error('useEnsureAsaasWebhook error:', err);
      }
    };

    ensure();
  }, [toast]);
}
