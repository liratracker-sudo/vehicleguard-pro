import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InactiveCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  days_inactive: number;
  clients_count: number;
  vehicles_count: number;
  contracts_count: number;
  admin_email: string | null;
  admin_name: string | null;
  admin_phone: string | null;
  already_sent_email: boolean;
  already_sent_whatsapp: boolean;
}

interface EmailLog {
  id: string;
  company_id: string;
  email: string;
  admin_name: string | null;
  template_type: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  company_name?: string;
  channel?: 'email' | 'whatsapp';
  phone?: string;
}

interface ReengagementStats {
  totalInactive: number;
  emailsSentThisMonth: number;
  whatsappSentThisMonth: number;
  lastSentAt: string | null;
}

export type ChannelType = 'email' | 'whatsapp' | 'both';

export function useReengagement() {
  const [inactiveCompanies, setInactiveCompanies] = useState<InactiveCompany[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<ReengagementStats>({
    totalInactive: 0,
    emailsSentThisMonth: 0,
    whatsappSentThisMonth: 0,
    lastSentAt: null
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Call edge function with dry_run to get inactive companies
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/send-reengagement-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dry_run: true, min_days_inactive: 3 })
        }
      );

      const result = await response.json();
      console.log('Reengagement API response:', result);
      
      if (result.inactive_companies) {
        setInactiveCompanies(result.inactive_companies);
        setStats(prev => ({ ...prev, totalInactive: result.inactive_companies.length }));
      }

      // Load email logs
      const { data: logs, error: logsError } = await supabase
        .from('reengagement_email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      // Get company names for logs
      if (logs && logs.length > 0) {
        const companyIds = [...new Set(logs.map(l => l.company_id))];
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);

        const companyMap = new Map(companies?.map(c => [c.id, c.name]) || []);
        
        setEmailLogs(logs.map(log => ({
          ...log,
          company_name: companyMap.get(log.company_id) || 'Empresa desconhecida',
          channel: (log as any).channel || 'email',
          phone: (log as any).phone
        })));

        // Calculate stats
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        
        const sentThisMonth = logs.filter(l => 
          l.status === 'sent' && 
          l.sent_at && 
          new Date(l.sent_at) >= thisMonth
        );

        const emailsSent = sentThisMonth.filter(l => !(l as any).channel || (l as any).channel === 'email').length;
        const whatsappSent = sentThisMonth.filter(l => (l as any).channel === 'whatsapp').length;

        const lastSent = logs.find(l => l.status === 'sent')?.sent_at || null;

        setStats(prev => ({
          ...prev,
          emailsSentThisMonth: emailsSent,
          whatsappSentThisMonth: whatsappSent,
          lastSentAt: lastSent
        }));
      }
    } catch (error) {
      console.error('Error loading reengagement data:', error);
      toast.error('Erro ao carregar dados de reengajamento');
    } finally {
      setLoading(false);
    }
  };

  const sendEmails = async (
    companyIds?: string[], 
    templateType: string = 'first_reminder', 
    forceSend: boolean = false,
    channel: ChannelType = 'email'
  ) => {
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/send-reengagement-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            company_ids: companyIds,
            min_days_inactive: 3,
            template_type: templateType,
            force_send: forceSend,
            channel: channel,
            dry_run: false
          })
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const results = Array.isArray(result.results) ? result.results : (result.results?.details || []);
      const sent = results.filter((r: any) => r.status === 'sent').length;
      const skipped = results.filter((r: any) => r.status === 'skipped').length;
      const failed = results.filter((r: any) => r.status === 'failed').length;

      const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'both' ? 'mensagem(ns)' : 'email(s)';

      if (sent > 0) {
        toast.success(`${sent} ${channelLabel} enviado(s) com sucesso!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} empresa(s) puladas (sem contato ou já enviado)`);
      }
      if (failed > 0) {
        toast.error(`${failed} ${channelLabel} falharam ao enviar`);
      }

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error sending reengagement messages:', error);
      toast.error(error.message || 'Erro ao enviar mensagens de reengajamento');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    inactiveCompanies,
    emailLogs,
    stats,
    loading,
    sending,
    loadData,
    sendEmails
  };
}
