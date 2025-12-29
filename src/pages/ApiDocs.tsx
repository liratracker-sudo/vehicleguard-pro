import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Book, Code, Key, Terminal } from 'lucide-react'

const API_BASE_URL = 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/tracker-api'

const CodeBlock = ({ children, language = 'bash' }: { children: string; language?: string }) => (
  <ScrollArea className="w-full">
    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono whitespace-pre">
      {children}
    </pre>
  </ScrollArea>
)

const ApiDocsPage = () => {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Book className="h-8 w-8" />
            Documentação da API
          </h1>
          <p className="text-muted-foreground mt-2">
            API REST para integração com plataformas de rastreamento
          </p>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Autenticação
            </CardTitle>
            <CardDescription>
              Todas as requisições devem incluir sua API Key no header
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock>{`curl -H "X-API-Key: sk_live_sua_chave_aqui" \\
     ${API_BASE_URL}?action=client&cpf=12345678901`}</CodeBlock>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
              <strong>⚠️ Importante:</strong> Nunca exponha sua API Key em código cliente (frontend). 
              Use apenas em servidores backend.
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Endpoints
            </CardTitle>
            <CardDescription>
              Base URL: <code className="text-primary">{API_BASE_URL}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="client" className="w-full">
              <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="client">Buscar Cliente</TabsTrigger>
                <TabsTrigger value="vehicles">Veículos</TabsTrigger>
                <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                <TabsTrigger value="create">Criar Cobrança</TabsTrigger>
              </TabsList>

              {/* GET Client */}
              <TabsContent value="client" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10">GET</Badge>
                  <code className="text-sm">?action=client</code>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Parâmetros de Busca</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li><code>cpf</code> - Buscar por CPF/CNPJ</li>
                    <li><code>plate</code> - Buscar por placa do veículo</li>
                    <li><code>phone</code> - Buscar por telefone</li>
                    <li><code>name</code> - Buscar por nome (parcial)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Exemplo - Buscar por CPF</h4>
                  <CodeBlock>{`curl -X GET "${API_BASE_URL}?action=client&cpf=12345678901" \\
     -H "X-API-Key: sk_live_xxx"`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Exemplo - Buscar por Placa</h4>
                  <CodeBlock>{`curl -X GET "${API_BASE_URL}?action=client&plate=ABC1234" \\
     -H "X-API-Key: sk_live_xxx"`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resposta</h4>
                  <CodeBlock language="json">{`{
  "success": true,
  "client": {
    "id": "uuid",
    "name": "João Silva",
    "document": "123.456.789-01",
    "phone": "11999999999",
    "email": "joao@email.com",
    "status": "active",
    "address": {
      "street": "Rua Exemplo",
      "number": "123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "cep": "01234-567"
    },
    "payment_status": "em_dia",
    "days_overdue": 0,
    "pending_amount": 0
  },
  "vehicle": {
    "id": "uuid",
    "license_plate": "ABC1234",
    "brand": "Fiat",
    "model": "Uno",
    "year": 2020,
    "color": "Branco"
  }
}`}</CodeBlock>
                </div>
              </TabsContent>

              {/* GET Vehicles */}
              <TabsContent value="vehicles" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10">GET</Badge>
                  <code className="text-sm">?action=vehicles&client_id=uuid</code>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Parâmetros</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li><code>client_id</code> - ID do cliente (obrigatório)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Exemplo</h4>
                  <CodeBlock>{`curl -X GET "${API_BASE_URL}?action=vehicles&client_id=uuid-do-cliente" \\
     -H "X-API-Key: sk_live_xxx"`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resposta</h4>
                  <CodeBlock language="json">{`{
  "success": true,
  "vehicles": [
    {
      "id": "uuid",
      "license_plate": "ABC1234",
      "brand": "Fiat",
      "model": "Uno",
      "year": 2020,
      "color": "Branco",
      "has_gnv": false,
      "is_armored": false,
      "tracker_device_id": "DEV123",
      "tracker_status": "active"
    }
  ]
}`}</CodeBlock>
                </div>
              </TabsContent>

              {/* GET Payments */}
              <TabsContent value="payments" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10">GET</Badge>
                  <code className="text-sm">?action=payments&client_id=uuid</code>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Parâmetros</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li><code>client_id</code> - ID do cliente (obrigatório)</li>
                    <li><code>status</code> - Filtrar por status (opcional): pending, paid, overdue</li>
                    <li><code>limit</code> - Limite de resultados (padrão: 50)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Exemplo</h4>
                  <CodeBlock>{`curl -X GET "${API_BASE_URL}?action=payments&client_id=uuid&status=pending" \\
     -H "X-API-Key: sk_live_xxx"`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resposta</h4>
                  <CodeBlock language="json">{`{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "amount": 150.00,
      "due_date": "2025-01-15",
      "status": "pending",
      "description": "Mensalidade Janeiro/2025",
      "payment_url": "https://...",
      "pix_code": "00020126...",
      "paid_at": null,
      "created_at": "2025-01-01T10:00:00Z"
    }
  ],
  "summary": {
    "total_pending": 150.00,
    "total_overdue": 0,
    "total_paid_this_month": 300.00
  }
}`}</CodeBlock>
                </div>
              </TabsContent>

              {/* POST Create Charge */}
              <TabsContent value="create" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10">POST</Badge>
                  <code className="text-sm">/</code>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Body (JSON)</h4>
                  <CodeBlock language="json">{`{
  "action": "create_charge",
  "client_id": "uuid-do-cliente",
  "amount": 150.00,
  "due_date": "2025-02-01",
  "description": "Mensalidade Fevereiro/2025"
}`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Exemplo cURL</h4>
                  <CodeBlock>{`curl -X POST "${API_BASE_URL}" \\
     -H "X-API-Key: sk_live_xxx" \\
     -H "Content-Type: application/json" \\
     -d '{
       "action": "create_charge",
       "client_id": "uuid-do-cliente",
       "amount": 150.00,
       "due_date": "2025-02-01",
       "description": "Mensalidade Fevereiro/2025"
     }'`}</CodeBlock>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resposta</h4>
                  <CodeBlock language="json">{`{
  "success": true,
  "charge": {
    "id": "uuid",
    "client_id": "uuid",
    "amount": 150.00,
    "due_date": "2025-02-01",
    "description": "Mensalidade Fevereiro/2025",
    "status": "pending",
    "payment_url": null,
    "pix_code": null,
    "created_at": "2025-01-15T10:00:00Z"
  }
}`}</CodeBlock>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Códigos de Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-3 border rounded">
                <Badge variant="destructive">401</Badge>
                <div>
                  <p className="font-medium">Unauthorized</p>
                  <p className="text-sm text-muted-foreground">API Key não fornecida ou inválida</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 border rounded">
                <Badge variant="destructive">403</Badge>
                <div>
                  <p className="font-medium">Forbidden</p>
                  <p className="text-sm text-muted-foreground">API Key não tem permissão para esta ação</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 border rounded">
                <Badge variant="destructive">404</Badge>
                <div>
                  <p className="font-medium">Not Found</p>
                  <p className="text-sm text-muted-foreground">Cliente ou recurso não encontrado</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 border rounded">
                <Badge variant="destructive">400</Badge>
                <div>
                  <p className="font-medium">Bad Request</p>
                  <p className="text-sm text-muted-foreground">Parâmetros obrigatórios faltando ou inválidos</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 border rounded">
                <Badge variant="destructive">500</Badge>
                <div>
                  <p className="font-medium">Internal Server Error</p>
                  <p className="text-sm text-muted-foreground">Erro interno do servidor</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SDK Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplos de Integração</CardTitle>
            <CardDescription>Código de exemplo em diferentes linguagens</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="javascript">
              <TabsList>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>

              <TabsContent value="javascript" className="mt-4">
                <CodeBlock language="javascript">{`// JavaScript / Node.js
const API_KEY = 'sk_live_xxx';
const BASE_URL = '${API_BASE_URL}';

async function getClientByCPF(cpf) {
  const response = await fetch(
    \`\${BASE_URL}?action=client&cpf=\${cpf}\`,
    {
      headers: {
        'X-API-Key': API_KEY
      }
    }
  );
  return response.json();
}

async function createCharge(clientId, amount, dueDate) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'create_charge',
      client_id: clientId,
      amount: amount,
      due_date: dueDate
    })
  });
  return response.json();
}

// Uso
const client = await getClientByCPF('12345678901');
console.log(client);`}</CodeBlock>
              </TabsContent>

              <TabsContent value="python" className="mt-4">
                <CodeBlock language="python">{`# Python
import requests

API_KEY = 'sk_live_xxx'
BASE_URL = '${API_BASE_URL}'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

def get_client_by_cpf(cpf):
    response = requests.get(
        f'{BASE_URL}?action=client&cpf={cpf}',
        headers=headers
    )
    return response.json()

def create_charge(client_id, amount, due_date):
    response = requests.post(
        BASE_URL,
        headers=headers,
        json={
            'action': 'create_charge',
            'client_id': client_id,
            'amount': amount,
            'due_date': due_date
        }
    )
    return response.json()

# Uso
client = get_client_by_cpf('12345678901')
print(client)`}</CodeBlock>
              </TabsContent>

              <TabsContent value="php" className="mt-4">
                <CodeBlock language="php">{`<?php
// PHP
$API_KEY = 'sk_live_xxx';
$BASE_URL = '${API_BASE_URL}';

function getClientByCPF($cpf) {
    global $API_KEY, $BASE_URL;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$BASE_URL?action=client&cpf=$cpf");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $API_KEY"
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

function createCharge($clientId, $amount, $dueDate) {
    global $API_KEY, $BASE_URL;
    
    $data = [
        'action' => 'create_charge',
        'client_id' => $clientId,
        'amount' => $amount,
        'due_date' => $dueDate
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $BASE_URL);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-API-Key: $API_KEY",
        "Content-Type: application/json"
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Uso
$client = getClientByCPF('12345678901');
print_r($client);
?>`}</CodeBlock>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

export default ApiDocsPage
