import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { 
  Code, 
  Users, 
  Car, 
  CreditCard, 
  AlertTriangle, 
  RefreshCw, 
  Lock,
  Copy,
  Check,
  ExternalLink,
  Zap,
  Download,
  Loader2
} from "lucide-react";

const PublicApiDocs = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    try {
      toast("Gerando PDF da documentação...");
      
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `VehicleGuard-API-Docs-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(contentRef.current).save();
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const CodeBlock = ({ code, language = "javascript", id }: { code: string; language?: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );

  const baseUrl = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/tracker-api";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">VehicleGuard Pro API</h1>
                <p className="text-sm text-slate-400">Documentação para Integração com Traccar</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleExportPDF}
                disabled={isExporting}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar PDF
              </Button>
              <Badge variant="outline" className="border-green-500 text-green-400">
                v1.0
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl" ref={contentRef}>
        {/* Quick Start */}
        <Card className="mb-8 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-400" />
              Quick Start
            </CardTitle>
            <CardDescription className="text-slate-400">
              Configure sua integração em poucos passos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-white">Base URL</h4>
                <CodeBlock 
                  code={baseUrl} 
                  id="base-url" 
                />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-white">Autenticação</h4>
                <CodeBlock 
                  code={`Header: X-API-Key: sk_sua_chave_aqui`} 
                  id="auth-header" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Tabs defaultValue="overdue" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700 p-1 flex-wrap h-auto">
            <TabsTrigger value="overdue" className="data-[state=active]:bg-blue-600">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Inadimplentes
            </TabsTrigger>
            <TabsTrigger value="sync" className="data-[state=active]:bg-blue-600">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Veículos
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-blue-600">
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="block" className="data-[state=active]:bg-blue-600">
              <Lock className="h-4 w-4 mr-2" />
              Bloqueio
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="data-[state=active]:bg-blue-600">
              <Car className="h-4 w-4 mr-2" />
              Veículos
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-blue-600">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagamentos
            </TabsTrigger>
          </TabsList>

          {/* Overdue Clients */}
          <TabsContent value="overdue">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">GET</Badge>
                  <CardTitle className="text-white">Listar Clientes Inadimplentes</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Retorna todos os clientes com pagamentos vencidos. Ideal para automação de bloqueio no Traccar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`GET ${baseUrl}?action=overdue_clients&days_min=1&days_max=90&block_threshold=5`}
                    id="overdue-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Parâmetros</h4>
                  <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">days_min</span>
                      <span className="text-slate-400">Mínimo de dias de atraso (default: 1)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">days_max</span>
                      <span className="text-slate-400">Máximo de dias de atraso (default: 9999)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">block_threshold</span>
                      <span className="text-slate-400">Dias para marcar should_block=true (default: 5)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "clients": [
    {
      "id": "uuid-do-cliente",
      "name": "João Silva",
      "document": "12345678901",
      "phone": "11999999999",
      "email": "joao@email.com",
      "status": "active",
      "service_status": "active",
      "days_overdue": 15,
      "pending_amount": 300.00,
      "overdue_payments_count": 2,
      "should_block": true,
      "vehicles": [
        {
          "id": "uuid-do-veiculo",
          "license_plate": "ABC1234",
          "tracker_device_id": "DEV123",
          "tracker_status": "active",
          "brand": "Toyota",
          "model": "Corolla"
        }
      ]
    }
  ],
  "summary": {
    "total_clients": 15,
    "total_to_block": 8,
    "block_threshold_days": 5
  }
}`}
                    id="overdue-response"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Exemplo em JavaScript</h4>
                  <CodeBlock 
                    code={`const response = await fetch(
  '${baseUrl}?action=overdue_clients&block_threshold=5',
  {
    headers: {
      'X-API-Key': 'sk_sua_chave_aqui'
    }
  }
);

const data = await response.json();

// Processar clientes para bloqueio
for (const client of data.clients) {
  if (client.should_block) {
    console.log(\`Bloquear: \${client.name} - \${client.days_overdue} dias\`);
    
    for (const vehicle of client.vehicles) {
      // Bloquear no Traccar usando tracker_device_id
      console.log(\`  Veículo: \${vehicle.license_plate} - Device: \${vehicle.tracker_device_id}\`);
    }
  }
}`}
                    id="overdue-js"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Vehicles */}
          <TabsContent value="sync">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">GET</Badge>
                  <CardTitle className="text-white">Sincronizar Veículos</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Retorna todos os veículos com status de pagamento do cliente. Ideal para sincronização inicial com Traccar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`GET ${baseUrl}?action=sync_vehicles&block_threshold=5`}
                    id="sync-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Parâmetros</h4>
                  <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">block_threshold</span>
                      <span className="text-slate-400">Dias para marcar should_block=true (default: 5)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">include_inactive</span>
                      <span className="text-slate-400">Incluir clientes inativos (default: false)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "vehicles": [
    {
      "id": "uuid-do-veiculo",
      "license_plate": "ABC1234",
      "tracker_device_id": "DEV123",
      "tracker_status": "active",
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "color": "Preto",
      "client_id": "uuid-do-cliente",
      "client_name": "João Silva",
      "client_document": "12345678901",
      "client_phone": "11999999999",
      "client_email": "joao@email.com",
      "client_status": "active",
      "service_status": "active",
      "payment_status": "atrasado",
      "days_overdue": 15,
      "pending_amount": 300.00,
      "should_block": true
    }
  ],
  "summary": {
    "total_vehicles": 150,
    "total_to_block": 12,
    "block_threshold_days": 5
  }
}`}
                    id="sync-response"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Clients */}
          <TabsContent value="clients">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">GET</Badge>
                  <CardTitle className="text-white">Listar Todos os Clientes</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Retorna todos os clientes com veículos e status de pagamento. Suporta paginação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`GET ${baseUrl}?action=all_clients&limit=100&offset=0`}
                    id="clients-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Parâmetros</h4>
                  <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">limit</span>
                      <span className="text-slate-400">Quantidade de registros (default: 1000)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">offset</span>
                      <span className="text-slate-400">Pular registros (default: 0)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">include_inactive</span>
                      <span className="text-slate-400">Incluir clientes inativos (default: false)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "clients": [
    {
      "id": "uuid-do-cliente",
      "name": "João Silva",
      "document": "12345678901",
      "phone": "11999999999",
      "email": "joao@email.com",
      "status": "active",
      "service_status": "active",
      "address": {
        "street": "Rua das Flores",
        "number": "123",
        "complement": "Apto 45",
        "neighborhood": "Centro",
        "city": "São Paulo",
        "state": "SP",
        "cep": "01234567"
      },
      "payment_status": "em_dia",
      "days_overdue": 0,
      "pending_amount": 0,
      "vehicles": [
        {
          "id": "uuid",
          "license_plate": "ABC1234",
          "tracker_device_id": "DEV123",
          "tracker_status": "active",
          "brand": "Toyota",
          "model": "Corolla"
        }
      ]
    }
  ],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}`}
                    id="clients-response"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Exemplo em JavaScript</h4>
                  <CodeBlock 
                    code={`const response = await fetch(
  '${baseUrl}?action=all_clients&limit=100',
  {
    headers: {
      'X-API-Key': 'sk_sua_chave_aqui'
    }
  }
);

const data = await response.json();

// Processar clientes
for (const client of data.clients) {
  console.log(\`Cliente: \${client.name}\`);
  console.log(\`  Status: \${client.payment_status}\`);
  console.log(\`  Veículos: \${client.vehicles.length}\`);
}`}
                    id="clients-js"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Paginação Completa</h4>
                  <p className="text-slate-400 text-sm mb-3">
                    Para obter todos os clientes quando há muitos registros, use paginação:
                  </p>
                  <CodeBlock 
                    code={`async function getAllClients(apiKey) {
  let allClients = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(
      \`${baseUrl}?action=all_clients&limit=\${limit}&offset=\${offset}\`,
      { headers: { 'X-API-Key': apiKey } }
    );
    
    const data = await response.json();
    allClients = [...allClients, ...data.clients];
    
    // Verifica se há mais páginas
    if (!data.pagination.has_more) break;
    offset += limit;
  }
  
  return allClients;
}

// Uso
const clients = await getAllClients('sk_sua_chave_aqui');
console.log(\`Total: \${clients.length} clientes\`);`}
                    id="clients-pagination"
                  />
                </div>

                <div className="border-t border-slate-700 pt-6 mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-green-600">GET</Badge>
                    <h4 className="font-medium text-white">Buscar Cliente Específico</h4>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">
                    Busque clientes por CPF/CNPJ, placa, telefone ou nome usando o endpoint <code className="text-blue-400">action=client</code>
                  </p>
                  
                  <div className="bg-slate-900 rounded-lg p-4 space-y-3 mb-4">
                    <div className="text-sm">
                      <span className="text-blue-400">document</span>
                      <span className="text-slate-400 ml-2">- Busca por CPF/CNPJ</span>
                      <code className="text-slate-300 block mt-1 text-xs">?action=client&document=12345678901</code>
                    </div>
                    <div className="text-sm">
                      <span className="text-blue-400">plate</span>
                      <span className="text-slate-400 ml-2">- Busca por placa do veículo</span>
                      <code className="text-slate-300 block mt-1 text-xs">?action=client&plate=ABC1234</code>
                    </div>
                    <div className="text-sm">
                      <span className="text-blue-400">phone</span>
                      <span className="text-slate-400 ml-2">- Busca por telefone</span>
                      <code className="text-slate-300 block mt-1 text-xs">?action=client&phone=11999999999</code>
                    </div>
                    <div className="text-sm">
                      <span className="text-blue-400">name</span>
                      <span className="text-slate-400 ml-2">- Busca por nome (parcial)</span>
                      <code className="text-slate-300 block mt-1 text-xs">?action=client&name=João</code>
                    </div>
                  </div>

                  <CodeBlock 
                    code={`// Buscar por CPF
const response = await fetch(
  '${baseUrl}?action=client&document=12345678901',
  { headers: { 'X-API-Key': 'sk_sua_chave_aqui' } }
);

const data = await response.json();

if (data.client) {
  console.log(\`Encontrado: \${data.client.name}\`);
  console.log(\`Status: \${data.client.payment_status}\`);
} else {
  console.log('Cliente não encontrado');
}`}
                    id="client-search"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register Block */}
          <TabsContent value="block">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-600">POST</Badge>
                  <CardTitle className="text-white">Registrar Bloqueio/Desbloqueio</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Registra uma ação de bloqueio ou desbloqueio executada pelo Traccar. Atualiza o status no sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`POST ${baseUrl}`}
                    id="block-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Body (JSON)</h4>
                  <CodeBlock 
                    code={`{
  "action": "register_block",
  "vehicle_id": "uuid-do-veiculo",    // ou client_id
  "client_id": "uuid-do-cliente",      // opcional se vehicle_id fornecido
  "blocked": true,                     // true = bloquear, false = desbloquear
  "blocked_by": "traccar_sync",        // identificação do sistema
  "reason": "Inadimplência - 15 dias"  // motivo do bloqueio
}`}
                    id="block-body"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "action": "block",
  "vehicle_id": "uuid-do-veiculo",
  "client_id": "uuid-do-cliente",
  "new_status": "blocked",
  "reason": "Inadimplência - 15 dias",
  "registered_at": "2024-01-15T10:30:00.000Z"
}`}
                    id="block-response"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Exemplo em JavaScript</h4>
                  <CodeBlock 
                    code={`// Após bloquear no Traccar, registrar no sistema
const response = await fetch('${baseUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'sk_sua_chave_aqui'
  },
  body: JSON.stringify({
    action: 'register_block',
    vehicle_id: 'uuid-do-veiculo',
    blocked: true,
    blocked_by: 'traccar_cron',
    reason: 'Bloqueio automático - 15 dias de atraso'
  })
});

const result = await response.json();
console.log('Bloqueio registrado:', result);`}
                    id="block-js"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vehicles by Client */}
          <TabsContent value="vehicles">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">GET</Badge>
                  <CardTitle className="text-white">Veículos por Cliente</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Retorna todos os veículos de um cliente específico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`GET ${baseUrl}?action=vehicles&client_id=uuid-do-cliente`}
                    id="vehicles-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "vehicles": [
    {
      "id": "uuid-do-veiculo",
      "license_plate": "ABC1234",
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "color": "Preto",
      "has_gnv": false,
      "is_armored": false,
      "tracker_device_id": "DEV123",
      "tracker_status": "active"
    }
  ]
}`}
                    id="vehicles-response"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">GET</Badge>
                  <CardTitle className="text-white">Pagamentos por Cliente</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Retorna o histórico de pagamentos de um cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Endpoint</h4>
                  <CodeBlock 
                    code={`GET ${baseUrl}?action=payments&client_id=uuid-do-cliente&status=pending`}
                    id="payments-endpoint"
                  />
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Parâmetros</h4>
                  <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">client_id</span>
                      <span className="text-slate-400">UUID do cliente (obrigatório)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">status</span>
                      <span className="text-slate-400">Filtrar por status: pending, paid, overdue</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">limit</span>
                      <span className="text-slate-400">Quantidade de registros (default: 50)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-2">Resposta de Exemplo</h4>
                  <CodeBlock 
                    code={`{
  "success": true,
  "payments": [
    {
      "id": "uuid-do-pagamento",
      "amount": 150.00,
      "due_date": "2024-01-15",
      "status": "pending",
      "description": "Mensalidade Janeiro/2024",
      "payment_url": "https://...",
      "pix_code": "00020126...",
      "barcode": "23793.38128...",
      "paid_at": null,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "summary": {
    "total_pending": 150.00,
    "total_overdue": 300.00,
    "total_paid_this_month": 450.00
  }
}`}
                    id="payments-response"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Integration Flow */}
        <Card className="mt-8 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-400" />
              Fluxo de Integração Recomendado
            </CardTitle>
            <CardDescription className="text-slate-400">
              Como implementar o bloqueio automático no Traccar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-white">Sincronização Inicial</h4>
                  <p className="text-slate-400 text-sm">
                    Use <code className="bg-slate-700 px-1 rounded">?action=sync_vehicles</code> para mapear todos os veículos 
                    com seus <code className="bg-slate-700 px-1 rounded">tracker_device_id</code> para os dispositivos no Traccar.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-white">Verificação Periódica (CRON)</h4>
                  <p className="text-slate-400 text-sm">
                    Configure um CRON no Traccar para consultar <code className="bg-slate-700 px-1 rounded">?action=overdue_clients&block_threshold=5</code> 
                    a cada hora. Isso retorna apenas clientes que devem ser bloqueados.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-white">Executar Bloqueio no Traccar</h4>
                  <p className="text-slate-400 text-sm">
                    Para cada cliente com <code className="bg-slate-700 px-1 rounded">should_block: true</code>, 
                    use a API do Traccar para desabilitar o usuário e seus dispositivos.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-white">Registrar Bloqueio</h4>
                  <p className="text-slate-400 text-sm">
                    Após bloquear no Traccar, chame <code className="bg-slate-700 px-1 rounded">POST action: register_block</code> 
                    para manter o status sincronizado no sistema de gestão.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-medium text-white">Desbloqueio Automático</h4>
                  <p className="text-slate-400 text-sm">
                    Quando o cliente pagar, consulte novamente e verifique <code className="bg-slate-700 px-1 rounded">should_block: false</code>. 
                    Reative no Traccar e registre o desbloqueio.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h4 className="font-medium text-blue-300 mb-2">💡 Dica para Integração com IA</h4>
              <p className="text-slate-300 text-sm">
                Compartilhe esta URL de documentação com a IA do Antigravity ou qualquer outra ferramenta de automação.
                A IA pode ler esta página e gerar o código de integração automaticamente.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-slate-800 text-blue-300 px-2 py-1 rounded text-sm flex-1 overflow-x-auto">
                  https://vehicleguard-pro.lovable.app/docs/api
                </code>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-blue-500 text-blue-300"
                  onClick={() => copyToClipboard('https://vehicleguard-pro.lovable.app/docs/api', 'docs-url')}
                >
                  {copiedCode === 'docs-url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card className="mt-8 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Códigos de Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">401</Badge>
                  <span className="text-white font-medium">Não Autorizado</span>
                </div>
                <p className="text-slate-400 text-sm">API Key não fornecida ou inválida</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">403</Badge>
                  <span className="text-white font-medium">Proibido</span>
                </div>
                <p className="text-slate-400 text-sm">API Key não tem permissão para esta ação</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">404</Badge>
                  <span className="text-white font-medium">Não Encontrado</span>
                </div>
                <p className="text-slate-400 text-sm">Cliente ou recurso não encontrado</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">500</Badge>
                  <span className="text-white font-medium">Erro Interno</span>
                </div>
                <p className="text-slate-400 text-sm">Erro no servidor, tente novamente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-500 text-sm pb-8">
          <p>VehicleGuard Pro API v1.0 • Documentação para Integração</p>
          <p className="mt-1">
            Precisa de uma API Key? Entre em contato com o administrador do sistema.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default PublicApiDocs;
