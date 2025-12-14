import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DREData } from "@/hooks/useReportData";

interface DREReportProps {
  data: DREData;
  selectedDate: Date;
  companyName?: string;
}

export const DREReport = forwardRef<HTMLDivElement, DREReportProps>(
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
            DEMONSTRATIVO DE RESULTADOS (DRE)
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
          {/* Receita Bruta */}
          <div className="bg-green-50 p-4 rounded">
            <div className="flex justify-between items-center font-semibold text-green-800">
              <span>RECEITA BRUTA</span>
              <span>{formatCurrency(data.grossRevenue)}</span>
            </div>
            <div className="mt-2 pl-4 text-sm text-green-700">
              <div className="flex justify-between">
                <span>Receita de Serviços/Cobranças</span>
                <span>{formatCurrency(data.grossRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Receita Líquida */}
          <div className="border-t border-b border-gray-300 py-3">
            <div className="flex justify-between items-center font-bold text-gray-900">
              <span>RECEITA LÍQUIDA</span>
              <span>{formatCurrency(data.netRevenue)}</span>
            </div>
          </div>

          {/* Despesas Operacionais */}
          <div className="bg-red-50 p-4 rounded">
            <div className="flex justify-between items-center font-semibold text-red-800">
              <span>DESPESAS OPERACIONAIS</span>
              <span></span>
            </div>
            <div className="mt-2 pl-4 text-sm space-y-1">
              {data.expenses.length > 0 ? (
                data.expenses.map((expense, index) => (
                  <div key={index} className="flex justify-between text-red-700">
                    <span>{expense.category}</span>
                    <span>{formatCurrency(expense.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-red-700 italic">Nenhuma despesa no período</div>
              )}
              <div className="flex justify-between font-semibold text-red-800 pt-2 border-t border-red-200">
                <span>Total Despesas</span>
                <span>{formatCurrency(data.totalExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Lucro Operacional */}
          <div className={`p-4 rounded ${data.operatingProfit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <div className={`flex justify-between items-center font-bold text-lg ${data.operatingProfit >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              <span>LUCRO OPERACIONAL</span>
              <span>{formatCurrency(data.operatingProfit)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>Margem de Lucro</span>
              <span>{data.profitMargin.toFixed(1)}%</span>
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

DREReport.displayName = "DREReport";
