import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';

export interface ClientScore {
  id: string;
  client_id: string;
  company_id: string;
  score: number;
  total_payments: number;
  paid_on_time: number;
  paid_late: number;
  overdue_count: number;
  avg_days_late: number;
  max_days_late: number;
  last_calculated_at: string;
}

interface PaymentStats {
  total: number;
  paidOnTime: number;
  paidLate: number;
  overdue: number;
  avgDaysLate: number;
  maxDaysLate: number;
}

// Calcular score baseado nas estatísticas de pagamento
function calculateScore(stats: PaymentStats): number {
  let score = 100;
  
  // Penalidade por média de dias de atraso: -5 pontos por dia
  score -= Math.min(stats.avgDaysLate * 5, 40);
  
  // Penalidade por taxa de atraso
  if (stats.total > 0) {
    const lateRate = (stats.paidLate + stats.overdue) / stats.total;
    if (lateRate > 0.5) score -= 20;
    else if (lateRate > 0.3) score -= 10;
    else if (lateRate > 0.1) score -= 5;
  }
  
  // Penalidade por cobranças em atraso atuais: -10 por cobrança
  score -= Math.min(stats.overdue * 10, 30);
  
  // Penalidade por máximo de dias de atraso
  if (stats.maxDaysLate > 60) score -= 10;
  else if (stats.maxDaysLate > 30) score -= 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Hook para buscar scores de todos os clientes
export function useClientScores() {
  const [scores, setScores] = useState<Record<string, ClientScore>>({});
  const [loading, setLoading] = useState(true);
  const { companyId } = useCompanyId();

  const loadScores = useCallback(async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('client_scores')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) throw error;
      
      const scoresMap: Record<string, ClientScore> = {};
      data?.forEach(score => {
        scoresMap[score.client_id] = score as ClientScore;
      });
      
      setScores(scoresMap);
    } catch (error) {
      console.error('Erro ao carregar scores:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Calcular e atualizar score de um cliente
  const calculateClientScore = useCallback(async (clientId: string): Promise<ClientScore | null> => {
    if (!companyId) return null;
    
    try {
      // Buscar pagamentos dos últimos 3 meses
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_transactions')
        .select('id, status, due_date, paid_at, amount')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .gte('due_date', threeMonthsAgo.toISOString().split('T')[0]);
      
      if (paymentsError) throw paymentsError;
      
      // Calcular estatísticas
      let paidOnTime = 0;
      let paidLate = 0;
      let overdue = 0;
      let totalDaysLate = 0;
      let maxDaysLate = 0;
      let latePaymentsCount = 0;
      
      payments?.forEach(payment => {
        if (payment.status === 'paid' && payment.paid_at && payment.due_date) {
          const dueDate = new Date(payment.due_date);
          const paidDate = new Date(payment.paid_at);
          const daysLate = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLate <= 0) {
            paidOnTime++;
          } else {
            paidLate++;
            totalDaysLate += daysLate;
            latePaymentsCount++;
            maxDaysLate = Math.max(maxDaysLate, daysLate);
          }
        } else if (payment.status === 'overdue' || payment.status === 'pending') {
          if (payment.due_date) {
            const dueDate = new Date(payment.due_date);
            const today = new Date();
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysOverdue > 0) {
              overdue++;
              totalDaysLate += daysOverdue;
              latePaymentsCount++;
              maxDaysLate = Math.max(maxDaysLate, daysOverdue);
            }
          }
        }
      });
      
      const stats: PaymentStats = {
        total: payments?.length || 0,
        paidOnTime,
        paidLate,
        overdue,
        avgDaysLate: latePaymentsCount > 0 ? totalDaysLate / latePaymentsCount : 0,
        maxDaysLate,
      };
      
      const score = calculateScore(stats);
      
      // Upsert no banco
      const scoreData = {
        client_id: clientId,
        company_id: companyId,
        score,
        total_payments: stats.total,
        paid_on_time: stats.paidOnTime,
        paid_late: stats.paidLate,
        overdue_count: stats.overdue,
        avg_days_late: Number(stats.avgDaysLate.toFixed(2)),
        max_days_late: stats.maxDaysLate,
        last_calculated_at: new Date().toISOString(),
      };
      
      const { data: upsertedScore, error: upsertError } = await supabase
        .from('client_scores')
        .upsert(scoreData, { onConflict: 'client_id' })
        .select()
        .single();
      
      if (upsertError) throw upsertError;
      
      // Atualizar cache local
      setScores(prev => ({
        ...prev,
        [clientId]: upsertedScore as ClientScore,
      }));
      
      return upsertedScore as ClientScore;
    } catch (error) {
      console.error('Erro ao calcular score:', error);
      return null;
    }
  }, [companyId]);

  // Recalcular scores de todos os clientes
  const recalculateAllScores = useCallback(async (clientIds: string[]) => {
    setLoading(true);
    try {
      await Promise.all(clientIds.map(id => calculateClientScore(id)));
    } finally {
      setLoading(false);
    }
  }, [calculateClientScore]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  return {
    scores,
    loading,
    loadScores,
    calculateClientScore,
    recalculateAllScores,
    getScore: (clientId: string) => scores[clientId],
  };
}

// Hook para score de um cliente específico
export function useClientScore(clientId: string | undefined) {
  const [score, setScore] = useState<ClientScore | null>(null);
  const [loading, setLoading] = useState(true);
  const { companyId } = useCompanyId();

  useEffect(() => {
    if (!clientId || !companyId) {
      setLoading(false);
      return;
    }

    const loadScore = async () => {
      try {
        const { data, error } = await supabase
          .from('client_scores')
          .select('*')
          .eq('client_id', clientId)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        setScore(data as ClientScore | null);
      } catch (error) {
        console.error('Erro ao carregar score:', error);
      } finally {
        setLoading(false);
      }
    };

    loadScore();
  }, [clientId, companyId]);

  return { score, loading };
}
