import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load theme from database
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.company_id) {
          setIsLoading(false);
          return;
        }

        setCompanyId(profile.company_id);

        const { data: branding } = await supabase
          .from('company_branding')
          .select('theme_mode')
          .eq('company_id', profile.company_id)
          .single();

        if (branding?.theme_mode) {
          setThemeState(branding.theme_mode as ThemeMode);
          applyTheme(branding.theme_mode as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  const applyTheme = (newTheme: ThemeMode) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(newTheme);
  };

  const setTheme = async (newTheme: ThemeMode) => {
    if (!companyId) {
      toast({
        title: "Erro",
        description: "Empresa não identificada",
        variant: "destructive",
      });
      return;
    }

    try {
      setThemeState(newTheme);
      applyTheme(newTheme);

      // Check if branding exists
      const { data: existing } = await supabase
        .from('company_branding')
        .select('id')
        .eq('company_id', companyId)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('company_branding')
          .update({ theme_mode: newTheme })
          .eq('company_id', companyId);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('company_branding')
          .insert({
            company_id: companyId,
            theme_mode: newTheme,
          });

        if (error) throw error;
      }

      toast({
        title: "Tema atualizado",
        description: `Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} aplicado com sucesso`,
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      toast({
        title: "Erro ao salvar tema",
        description: "Não foi possível salvar o tema",
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
