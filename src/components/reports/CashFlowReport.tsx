import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CashFlowData } from "@/hooks/useReportData";

interface CashFlowReportProps {
  data: CashFlowData;
  selectedDate: Date;
  companyName?: string;
}

export const CashFlowReport = forwardRef<HTMLDivElement, CashFlowReportProps>(
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
            FLUXO DE CAIXA DETALHADO
          </h1>
          <p className="text-center text-gray-600 mt-2">
            {companyName}
          </p>
          <p className="text-center text-gray-600">
            Período: {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Entradas */}
          <div className="bg-green-50 p-4 rounded">
            <div className="flex justify-between items-center font-semibold text-green-800 mb-3">
              <span>ENTRADAS</span>
              <span></span>
            </div>
            <div className="pl-4 text-sm space-y-2">
              {data.inflows.length > 0 ? (
                data.inflows.map((inflow, index) => (
                  <div key={index} className="flex justify-between text-green-700">
                    <span>{inflow.source}</span>
                    <span>{formatCurrency(inflow.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-green-700 italic">Nenhuma entrada no período</div>
              )}
              <div className="flex justify-between font-bold text-green-800 pt-2 border-t border-green-200">
                <span>Total Entradas</span>
                <span>{formatCurrency(data.totalInflows)}</span>
              </div>
            </div>
          </div>

          {/* Saídas */}
          <div className="bg-red-50 p-4 rounded">
            <div className="flex justify-between items-center font-semibold text-red-800 mb-3">
              <span>SAÍDAS</span>
              <span></span>
            </div>
            <div className="pl-4 text-sm space-y-2">
              {data.outflows.length > 0 ? (
                data.outflows.map((outflow, index) => (
                  <div key={index} className="flex justify-between text-red-700">
                    <span>{outflow.category}</span>
                    <span>{formatCurrency(outflow.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-red-700 italic">Nenhuma saída no período</div>
              )}
              <div className="flex justify-between font-bold text-red-800 pt-2 border-t border-red-200">
                <span>Total Saídas</span>
                <span>{formatCurrency(data.totalOutflows)}</span>
              </div>
            </div>
          </div>

          {/* Saldos */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded ${data.periodBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <div className="text-sm text-gray-600">Saldo do Período</div>
              <div className={`text-xl font-bold ${data.periodBalance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                {formatCurrency(data.periodBalance)}
              </div>
            </div>
            <div className={`p-4 rounded ${data.accumulatedBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-sm text-gray-600">Saldo Acumulado</div>
              <div className={`text-xl font-bold ${data.accumulatedBalance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {formatCurrency(data.accumulatedBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        </div>
      </div>
    );
  }
);

CashFlowReport.displayName = "CashFlowReport";
