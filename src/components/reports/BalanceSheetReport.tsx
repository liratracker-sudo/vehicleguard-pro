import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BalanceSheetData } from "@/hooks/useReportData";

interface BalanceSheetReportProps {
  data: BalanceSheetData;
  selectedDate: Date;
  companyName?: string;
}

export const BalanceSheetReport = forwardRef<HTMLDivElement, BalanceSheetReportProps>(
  ({ data, selectedDate, companyName = "Empresa" }, ref) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-w-[600px]">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-center text-gray-900">
            BALANÇO PATRIMONIAL
          </h1>
          <p className="text-center text-gray-600 mt-2">
            {companyName}
          </p>
          <p className="text-center text-gray-600">
            Data: {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-2 gap-6">
          {/* Ativos */}
          <div className="bg-blue-50 p-4 rounded">
            <h2 className="font-bold text-blue-800 text-lg mb-4 pb-2 border-b border-blue-200">
              ATIVOS
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-blue-700">
                <span>Caixa (Saldo)</span>
                <span>{formatCurrency(data.assets.cash)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Contas a Receber</span>
                <span>{formatCurrency(data.assets.receivables)}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-800 pt-2 border-t border-blue-200">
                <span>Total Ativos</span>
                <span>{formatCurrency(data.assets.total)}</span>
              </div>
            </div>
          </div>

          {/* Passivos */}
          <div className="bg-red-50 p-4 rounded">
            <h2 className="font-bold text-red-800 text-lg mb-4 pb-2 border-b border-red-200">
              PASSIVOS
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-red-700">
                <span>Contas a Pagar</span>
                <span>{formatCurrency(data.liabilities.payables)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Despesas Pendentes</span>
                <span>{formatCurrency(data.liabilities.pendingExpenses)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-800 pt-2 border-t border-red-200">
                <span>Total Passivos</span>
                <span>{formatCurrency(data.liabilities.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Patrimônio Líquido */}
        <div className={`mt-6 p-6 rounded ${data.equity >= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
          <div className={`flex justify-between items-center text-xl font-bold ${data.equity >= 0 ? 'text-green-800' : 'text-orange-800'}`}>
            <span>PATRIMÔNIO LÍQUIDO</span>
            <span>{formatCurrency(data.equity)}</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            (Ativos - Passivos)
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        </div>
      </div>
    );
  }
);

BalanceSheetReport.displayName = "BalanceSheetReport";
