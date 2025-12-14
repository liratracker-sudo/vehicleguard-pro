import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  document?: string | null;
  status?: string | null;
  created_at: string;
}

interface ClientsReportProps {
  clients: Client[];
}

export const ClientsReport = forwardRef<HTMLDivElement, ClientsReportProps>(
  ({ clients }, ref) => {
    const activeClients = clients.filter(c => c.status === 'active');
    const inactiveClients = clients.filter(c => c.status !== 'active');
    const activePercentage = clients.length > 0 ? ((activeClients.length / clients.length) * 100).toFixed(1) : '0';

    const formatPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
      return phone;
    };

    const getStatusLabel = (status: string | null | undefined) => {
      switch (status) {
        case 'active': return 'Ativo';
        case 'inactive': return 'Inativo';
        case 'suspended': return 'Suspenso';
        default: return 'Ativo';
      }
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-w-[700px]">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">RELATÓRIO DE CLIENTES</h1>
          <p className="text-sm text-gray-600">
            Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {/* Summary */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">RESUMO</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total de Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ativos</p>
              <p className="text-2xl font-bold text-green-600">
                {activeClients.length} <span className="text-sm">({activePercentage}%)</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Inativos/Suspensos</p>
              <p className="text-2xl font-bold text-red-600">{inactiveClients.length}</p>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">LISTA DE CLIENTES</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="p-2 text-left text-sm">Nome</th>
                <th className="p-2 text-left text-sm">Telefone</th>
                <th className="p-2 text-left text-sm">E-mail</th>
                <th className="p-2 text-center text-sm">Status</th>
                <th className="p-2 text-center text-sm">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr key={client.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="p-2 text-sm border-b border-gray-200">{client.name}</td>
                  <td className="p-2 text-sm border-b border-gray-200">{formatPhone(client.phone)}</td>
                  <td className="p-2 text-sm border-b border-gray-200">{client.email || '-'}</td>
                  <td className="p-2 text-sm border-b border-gray-200 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      client.status === 'active' ? 'bg-green-100 text-green-800' :
                      client.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {getStatusLabel(client.status)}
                    </span>
                  </td>
                  <td className="p-2 text-sm border-b border-gray-200 text-center">
                    {format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Este relatório foi gerado automaticamente pelo sistema.</p>
        </div>
      </div>
    );
  }
);

ClientsReport.displayName = 'ClientsReport';
