import React, { forwardRef } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OverduePayment {
  id: string;
  client_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
}

interface DelinquencyReportProps {
  overduePayments: OverduePayment[];
}

export const DelinquencyReport = forwardRef<HTMLDivElement, DelinquencyReportProps>(
  ({ overduePayments }, ref) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const totalOverdue = overduePayments.reduce((sum, p) => sum + p.amount, 0);
    const avgDaysOverdue = overduePayments.length > 0
      ? Math.round(overduePayments.reduce((sum, p) => sum + p.days_overdue, 0) / overduePayments.length)
      : 0;

    // Group by overdue ranges
    const ranges = {
      '1-15 dias': overduePayments.filter(p => p.days_overdue >= 1 && p.days_overdue <= 15),
      '16-30 dias': overduePayments.filter(p => p.days_overdue >= 16 && p.days_overdue <= 30),
      '31-60 dias': overduePayments.filter(p => p.days_overdue >= 31 && p.days_overdue <= 60),
      '60+ dias': overduePayments.filter(p => p.days_overdue > 60),
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-w-[700px]">
        {/* Header */}
        <div className="border-b-2 border-red-600 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">RELATÓRIO DE INADIMPLÊNCIA</h1>
          <p className="text-sm text-gray-600">
            Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {/* Summary */}
        <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">RESUMO</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total em Atraso</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Quantidade de Cobranças</p>
              <p className="text-2xl font-bold text-gray-900">{overduePayments.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Média de Dias em Atraso</p>
              <p className="text-2xl font-bold text-orange-600">{avgDaysOverdue} dias</p>
            </div>
          </div>
        </div>

        {/* Distribution by Range */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">DISTRIBUIÇÃO POR FAIXA DE ATRASO</h2>
          <div className="space-y-2">
            {Object.entries(ranges).map(([range, payments]) => {
              const rangeTotal = payments.reduce((sum, p) => sum + p.amount, 0);
              return (
                <div key={range} className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">{range}</span>
                  <span className="text-sm text-gray-600">
                    {payments.length} cobrança(s) - <span className="font-semibold text-red-600">{formatCurrency(rangeTotal)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Table */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">DETALHAMENTO</h2>
          {overduePayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma cobrança em atraso encontrada.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-red-700 text-white">
                  <th className="p-2 text-left text-sm">Cliente</th>
                  <th className="p-2 text-right text-sm">Valor</th>
                  <th className="p-2 text-center text-sm">Vencimento</th>
                  <th className="p-2 text-center text-sm">Dias em Atraso</th>
                </tr>
              </thead>
              <tbody>
                {overduePayments
                  .sort((a, b) => b.days_overdue - a.days_overdue)
                  .map((payment, index) => (
                    <tr key={payment.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="p-2 text-sm border-b border-gray-200 font-medium">
                        {payment.client_name}
                      </td>
                      <td className="p-2 text-sm border-b border-gray-200 text-right font-semibold text-red-600">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="p-2 text-sm border-b border-gray-200 text-center">
                        {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="p-2 text-sm border-b border-gray-200 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          payment.days_overdue > 60 ? 'bg-red-200 text-red-800' :
                          payment.days_overdue > 30 ? 'bg-orange-200 text-orange-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {payment.days_overdue} dias
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-semibold">
                  <td className="p-2 text-sm">TOTAL</td>
                  <td className="p-2 text-sm text-right text-red-600">{formatCurrency(totalOverdue)}</td>
                  <td className="p-2 text-sm text-center">{overduePayments.length} cobranças</td>
                  <td className="p-2 text-sm text-center">Média: {avgDaysOverdue} dias</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Este relatório foi gerado automaticamente pelo sistema.</p>
        </div>
      </div>
    );
  }
);

DelinquencyReport.displayName = 'DelinquencyReport';
