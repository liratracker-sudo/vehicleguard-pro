import { forwardRef } from "react";
import { ClientWithoutCharge, CompanySummary } from "@/hooks/useMissingCharges";
import { formatDateTimeBR } from "@/lib/timezone";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MissingChargesReportProps {
  clients: ClientWithoutCharge[];
  companySummary: CompanySummary[];
  totalEstimatedValue: number;
  totalVehicles: number;
  clientsWithoutContract: number;
}

const formatPhone = (phone: string | null) => {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const MissingChargesReport = forwardRef<HTMLDivElement, MissingChargesReportProps>(
  ({ clients, companySummary, totalEstimatedValue, totalVehicles, clientsWithoutContract }, ref) => {
    const now = new Date();

    return (
      <div ref={ref} className="p-6 bg-white text-black min-w-[800px]">
        {/* Header */}
        <div className="border-b-4 border-amber-500 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-amber-700 flex items-center gap-2">
            ⚠️ RELATÓRIO DE AUDITORIA - CLIENTES SEM COBRANÇA
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Gerado em: {formatDateTimeBR(now)}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{clients.length}</p>
            <p className="text-sm text-amber-600">Clientes Afetados</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{formatCurrency(totalEstimatedValue)}</p>
            <p className="text-sm text-red-600">Valor Potencial/Mês</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{totalVehicles}</p>
            <p className="text-sm text-blue-600">Veículos Ativos</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-orange-700">{clientsWithoutContract}</p>
            <p className="text-sm text-orange-600">Sem Contrato</p>
          </div>
        </div>

        {/* Company Distribution */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
            📊 Distribuição por Empresa
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {companySummary.map((company) => (
              <div 
                key={company.company_name} 
                className="flex justify-between items-center bg-gray-50 border rounded px-4 py-2"
              >
                <span className="font-medium text-gray-700">{company.company_name}</span>
                <div className="text-right">
                  <span className="text-amber-700 font-semibold">{company.client_count} clientes</span>
                  <span className="text-gray-500 text-sm ml-2">
                    ({formatCurrency(company.total_value)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
            📋 Lista Detalhada de Clientes
          </h2>
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-100">
                <TableHead className="font-bold text-amber-800">#</TableHead>
                <TableHead className="font-bold text-amber-800">Cliente</TableHead>
                <TableHead className="font-bold text-amber-800">Empresa</TableHead>
                <TableHead className="font-bold text-amber-800">Telefone</TableHead>
                <TableHead className="font-bold text-amber-800 text-center">Veículos</TableHead>
                <TableHead className="font-bold text-amber-800 text-right">Valor Estimado</TableHead>
                <TableHead className="font-bold text-amber-800 text-center">Contrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client, index) => (
                <TableRow 
                  key={client.id} 
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-gray-600">{client.company_name}</TableCell>
                  <TableCell className="text-gray-600">{formatPhone(client.phone)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded text-sm ${
                      client.vehicle_count > 0 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {client.vehicle_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-700">
                    {formatCurrency(client.estimated_value)}
                  </TableCell>
                  <TableCell className="text-center">
                    {client.has_contract ? (
                      <span className="text-green-600 font-bold">✓ Sim</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Não</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Summary */}
        <div className="border-t-2 border-amber-500 pt-4 mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-gray-700">
              <strong>TOTAL:</strong> {clients.length} clientes | {totalVehicles} veículos | {formatCurrency(totalEstimatedValue)}/mês potencial
            </div>
            <div className="text-sm text-gray-500">
              {clientsWithoutContract} clientes sem contrato cadastrado
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center border-t pt-3">
            Este relatório foi gerado automaticamente pelo sistema para fins de auditoria.
            Recomenda-se regularizar as cobranças pendentes para evitar perda de receita.
          </p>
        </div>
      </div>
    );
  }
);

MissingChargesReport.displayName = "MissingChargesReport";
