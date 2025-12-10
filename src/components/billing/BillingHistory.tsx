import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateBR } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface PaymentHistoryData {
  month: string;
  received: number;
  pending: number;
  overdue: number;
  total: number;
}

export function BillingHistory() {
  const [historyData, setHistoryData] = useState<PaymentHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'6months' | '12months'>('6months');
  const { toast } = useToast();

  useEffect(() => {
    loadHistoryData();
  }, [period]);

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Calculate date range
      const months = period === '6months' ? 6 : 12;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data: payments, error } = await supabase
        .from('payment_transactions')
        .select('amount, status, created_at, due_date')
        .eq('company_id', profile.company_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group payments by month
      const monthlyData: { [key: string]: PaymentHistoryData } = {};
      
      // Initialize months
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        
        monthlyData[monthKey] = {
          month: monthName,
          received: 0,
          pending: 0,
          overdue: 0,
          total: 0
        };
      }

      // Process payments
      payments?.forEach(payment => {
        const monthKey = payment.created_at.substring(0, 7);
        if (monthlyData[monthKey]) {
          const amount = Number(payment.amount);
          monthlyData[monthKey].total += amount;
          
          switch (payment.status) {
            case 'paid':
              monthlyData[monthKey].received += amount;
              break;
            case 'pending':
              if (payment.due_date && payment.due_date < new Date().toISOString().split('T')[0]) {
                monthlyData[monthKey].overdue += amount;
              } else {
                monthlyData[monthKey].pending += amount;
              }
              break;
            case 'overdue':
              monthlyData[monthKey].overdue += amount;
              break;
          }
        }
      });

      setHistoryData(Object.values(monthlyData));
    } catch (error: any) {
      console.error('Error loading history data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de pagamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Mês', 'Recebido', 'Pendente', 'Vencido', 'Total'],
      ...historyData.map(row => [
        row.month,
        row.received.toFixed(2),
        row.pending.toFixed(2),
        row.overdue.toFixed(2),
        row.total.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico-cobrancas-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalReceived = historyData.reduce((sum, item) => sum + item.received, 0);
  const totalPending = historyData.reduce((sum, item) => sum + item.pending, 0);
  const totalOverdue = historyData.reduce((sum, item) => sum + item.overdue, 0);

  // Calculate trends
  const recentMonths = historyData.slice(-2);
  const receivedTrend = recentMonths.length === 2 ? 
    ((recentMonths[1].received - recentMonths[0].received) / recentMonths[0].received) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Histórico de Cobranças</h3>
          <p className="text-sm text-muted-foreground">
            Análise de performance financeira nos últimos {period === '6months' ? '6' : '12'} meses
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === '6months' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('6months')}
          >
            6 meses
          </Button>
          <Button
            variant={period === '12months' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('12months')}
          >
            12 meses
          </Button>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            {receivedTrend !== 0 && (
              <div className={`text-xs flex items-center ${receivedTrend > 0 ? 'text-success' : 'text-destructive'}`}>
                {receivedTrend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {Math.abs(receivedTrend).toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalReceived + totalPending + totalOverdue > 0 
                ? ((totalReceived / (totalReceived + totalPending + totalOverdue)) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução dos Pagamentos</CardTitle>
            <CardDescription>Tendência de recebimentos ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    'Valor'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="received" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  name="Recebido"
                />
                <Line 
                  type="monotone" 
                  dataKey="pending" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  name="Pendente"
                />
                <Line 
                  type="monotone" 
                  dataKey="overdue" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="Vencido"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Comparativo Mensal</CardTitle>
            <CardDescription>Volume de cobranças por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    'Valor'
                  ]}
                />
                <Bar dataKey="received" fill="hsl(var(--success))" name="Recebido" />
                <Bar dataKey="pending" fill="hsl(var(--warning))" name="Pendente" />
                <Bar dataKey="overdue" fill="hsl(var(--destructive))" name="Vencido" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}