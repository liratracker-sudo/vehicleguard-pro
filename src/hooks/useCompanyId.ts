import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache global para evitar múltiplas requisições
let cachedCompanyId: string | null = null;
let cachePromise: Promise<string | null> | null = null;

export function useCompanyId() {
  const [companyId, setCompanyId] = useState<string | null>(cachedCompanyId);
  const [loading, setLoading] = useState(!cachedCompanyId);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanyId = useCallback(async (): Promise<string | null> => {
    // Se já tem cache, retorna imediatamente
    if (cachedCompanyId) {
      return cachedCompanyId;
    }

    // Se já tem uma requisição em andamento, aguarda ela
    if (cachePromise) {
      return cachePromise;
    }

    // Cria nova requisição
    cachePromise = (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('Usuário não autenticado');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        
        if (!profile?.company_id) {
          throw new Error('Empresa não encontrada');
        }

        cachedCompanyId = profile.company_id;
        return cachedCompanyId;
      } catch (err) {
        console.error('[useCompanyId] Erro:', err);
        throw err;
      } finally {
        cachePromise = null;
      }
    })();

    return cachePromise;
  }, []);

  useEffect(() => {
    if (cachedCompanyId) {
      setCompanyId(cachedCompanyId);
      setLoading(false);
      return;
    }

    fetchCompanyId()
      .then((id) => {
        setCompanyId(id);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [fetchCompanyId]);

  // Função para limpar cache (útil no logout)
  const clearCache = useCallback(() => {
    cachedCompanyId = null;
    cachePromise = null;
    setCompanyId(null);
  }, []);

  // Função para obter company_id de forma síncrona se já em cache
  const getCompanyIdSync = useCallback(() => cachedCompanyId, []);

  return { 
    companyId, 
    loading, 
    error, 
    fetchCompanyId, 
    clearCache,
    getCompanyIdSync 
  };
}

// Função utilitária para obter company_id (para uso fora de componentes)
export async function getCompanyId(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.company_id) throw new Error('Empresa não encontrada');

  cachedCompanyId = profile.company_id;
  return cachedCompanyId;
}

// Limpar cache no logout
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    cachedCompanyId = null;
    cachePromise = null;
  }
});
