import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { MonthlyReportData } from "@/hooks/useReportData";

interface MonthlyReportProps {
  data: MonthlyReportData;
  selectedDate: Date;
  companyName?: string;
}

export const MonthlyReport = forwardRef<HTMLDivElement, MonthlyReportProps>(
  ({ data, selectedDate, companyName = "Empresa" }, ref) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const getChangeIcon = (value: number, isExpense = false) => {
      if (Math.abs(value) < 0.1) return <Minus className="w-4 h-4 text-gray-500" />;
      if (isExpense) {
        return value > 0 
          ? <ArrowUp className="w-4 h-4 text-red-500" />
          : <ArrowDown className="w-4 h-4 text-green-500" />;
      }
      return value > 0 
        ? <ArrowUp className="w-4 h-4 text-green-500" />
        : <ArrowDown className="w-4 h-4 text-red-500" />;
    };

    const getChangeColor = (value: number, isExpense = false) => {
      if (Math.abs(value) < 0.1) return "text-gray-600";
      if (isExpense) {
        return value > 0 ? "text-red-600" : "text-green-600";
      }
      return value > 0 ? "text-green-600" : "text-red-600";
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-w-[600px]">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-center text-gray-900">
            RELATÓRIO MENSAL
          </h1>
          <p className="text-center text-gray-600 mt-2">
            {companyName}
          </p>
          <p className="text-center text-gray-600">
            {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Resumo Executivo */}
        <div className="bg-gray-50 p-6 rounded mb-6">
          <h2 className="font-bold text-gray-800 text-lg mb-4">RESUMO EXECUTIVO</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Receitas</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(data.currentMonth.revenue)}
              </div>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <div className="text-sm text-gray-600">Total Despesas</div>
              <div className="text-2xl font-bold text-red-700">
                {formatCurrency(data.currentMonth.expenses)}
              </div>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <div className="text-sm text-gray-600">Lucro Líquido</div>
              <div className={`text-2xl font-bold ${data.currentMonth.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatCurrency(data.currentMonth.profit)}
              </div>
            </div>
            <div className="bg-white p-4 rounded shadow-sm">
              <div className="text-sm text-gray-600">Margem de Lucro</div>
              <div className={`text-2xl font-bold ${data.currentMonth.margin >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {data.currentMonth.margin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Comparativo */}
        <div className="bg-blue-50 p-6 rounded mb-6">
          <h2 className="font-bold text-blue-800 text-lg mb-4">COMPARATIVO COM MÊS ANTERIOR</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white p-3 rounded">
              <span className="text-gray-700">Receitas</span>
              <div className="flex items-center gap-2">
                {getChangeIcon(data.comparison.revenueChange)}
                <span className={`font-semibold ${getChangeColor(data.comparison.revenueChange)}`}>
                  {data.comparison.revenueChange >= 0 ? '+' : ''}{data.comparison.revenueChange.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">
                  ({formatCurrency(data.currentMonth.revenue - data.previousMonth.revenue)})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white p-3 rounded">
              <span className="text-gray-700">Despesas</span>
              <div className="flex items-center gap-2">
                {getChangeIcon(data.comparison.expensesChange, true)}
                <span className={`font-semibold ${getChangeColor(data.comparison.expensesChange, true)}`}>
                  {data.comparison.expensesChange >= 0 ? '+' : ''}{data.comparison.expensesChange.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">
                  ({formatCurrency(data.currentMonth.expenses - data.previousMonth.expenses)})
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white p-3 rounded">
              <span className="text-gray-700">Lucro</span>
              <div className="flex items-center gap-2">
                {getChangeIcon(data.comparison.profitChange)}
                <span className={`font-semibold ${getChangeColor(data.comparison.profitChange)}`}>
                  {data.comparison.profitChange >= 0 ? '+' : ''}{data.comparison.profitChange.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">
                  ({formatCurrency(data.currentMonth.profit - data.previousMonth.profit)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Despesas */}
        <div className="bg-orange-50 p-6 rounded">
          <h2 className="font-bold text-orange-800 text-lg mb-4">TOP 3 CATEGORIAS DE DESPESA</h2>
          {data.topExpenses.length > 0 ? (
            <div className="space-y-2">
              {data.topExpenses.map((expense, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-3 rounded">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{expense.category}</span>
                  </div>
                  <span className="font-semibold text-orange-700">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-orange-700 italic">Nenhuma despesa registrada no período</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        </div>
      </div>
    );
  }
);

MonthlyReport.displayName = "MonthlyReport";
