import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Função síncrona para obter tema inicial do localStorage
const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  }
  return 'light';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Aplicar tema imediatamente ao montar
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Sincronizar tema do banco em background
  const syncThemeFromDatabase = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      setCompanyId(profile.company_id);

      const { data: branding } = await supabase
        .from('company_branding')
        .select('theme_mode')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (branding?.theme_mode) {
        const dbTheme = branding.theme_mode as ThemeMode;
        // Atualiza se diferente do estado atual
        if (dbTheme !== theme) {
          setThemeState(dbTheme);
          applyTheme(dbTheme);
          localStorage.setItem('theme', dbTheme);
        }
      }
    } catch (error) {
      console.error('Error syncing theme from database:', error);
    }
  };

  // Sincronizar ao montar e escutar mudanças de autenticação
  useEffect(() => {
    syncThemeFromDatabase();

    // Listener para sincronizar tema imediatamente após login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Usar setTimeout para evitar deadlock
          setTimeout(() => {
            syncThemeFromDatabase();
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const applyTheme = (newTheme: ThemeMode) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(newTheme);
  };

  const ensureCompanyId = async (): Promise<string> => {
    if (companyId) return companyId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('Empresa não identificada');
    }

    setCompanyId(profile.company_id);
    return profile.company_id;
  };

  const setTheme = async (newTheme: ThemeMode) => {
    try {
      const effectiveCompanyId = await ensureCompanyId();

      setThemeState(newTheme);
      applyTheme(newTheme);
      localStorage.setItem('theme', newTheme);

      // Check if branding exists
      const { data: existing } = await supabase
        .from('company_branding')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('company_branding')
          .update({ theme_mode: newTheme })
          .eq('company_id', effectiveCompanyId);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('company_branding')
          .insert({
            company_id: effectiveCompanyId,
            theme_mode: newTheme,
          });

        if (error) throw error;
      }

      toast({
        title: "Tema atualizado",
        description: `Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} aplicado com sucesso`,
      });
    } catch (error: any) {
      console.error('Error saving theme:', error);
      toast({
        title: "Erro ao salvar tema",
        description: error.message || "Não foi possível salvar o tema",
        variant: "destructive",
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
