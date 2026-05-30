import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ManualPixSettings {
  id?: string;
  company_id?: string;
  is_active: boolean;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'aleatoria';
  beneficiary_name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  surcharge_type: 'percentage' | 'fixed';
  surcharge_value: number;
  instructions?: string | null;
}

const EMPTY: ManualPixSettings = {
  is_active: false,
  pix_key: '',
  pix_key_type: 'cpf',
  beneficiary_name: '',
  discount_type: 'percentage',
  discount_value: 0,
  surcharge_type: 'percentage',
  surcharge_value: 0,
  instructions: '',
};

export function useManualPixSettings() {
  const [settings, setSettings] = useState<ManualPixSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      const { data } = await supabase
        .from('manual_pix_settings' as any)
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (data) setSettings(data as any);
      else setSettings(EMPTY);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (next: ManualPixSettings) => {
    if (!companyId) return false;
    setSaving(true);
    try {
      const payload = { ...next, company_id: companyId };
      const { error } = await supabase
        .from('manual_pix_settings' as any)
        .upsert(payload, { onConflict: 'company_id' });
      if (error) throw error;
      toast({ title: 'Configurações salvas', description: 'PIX manual atualizado com sucesso.' });
      await load();
      return true;
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { settings, setSettings, loading, saving, save, reload: load };
}
