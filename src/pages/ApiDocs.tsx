import { useRef, useState } from 'react'
import html2pdf from 'html2pdf.js'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Book, Code, Key, Terminal, Download, Loader2 } from 'lucide-react'

const API_BASE_URL = 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/tracker-api'

const CodeBlock = ({ children, language = 'bash' }: { children: string; language?: string }) => (
  <ScrollArea className="w-full">
    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono whitespace-pre">
      {children}
    </pre>
  </ScrollArea>
)

const PdfCodeBlock = ({ children }: { children: string }) => (
  <pre style={{ 
    backgroundColor: '#f4f4f5', 
    padding: '12px', 
    borderRadius: '8px', 
    fontSize: '11px', 
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '8px 0'
  }}>
    {children}
  </pre>
)

const ApiDocsPage = () => {
  const pdfContentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const generatePDF = async () => {
    if (!pdfContentRef.current) return
    
    setGenerating(true)
    
    try {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: 'API_Tracker_Documentacao.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as ('avoid-all' | 'css' | 'legacy')[] }
      }
      
      await html2pdf().set(opt).from(pdfContentRef.current).save()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Book className="h-8 w-8" />
              Documentação da API
            </h1>
            <p className="text-muted-foreground mt-2">
              API REST para integração com plataformas de rastreamento
            </p>
          </div>
          <Button onClick={generatePDF} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </>
            )}
          </Button>
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

      {/* Hidden PDF Content */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfContentRef} style={{ width: '190mm', padding: '10mm', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#1a1a1a', backgroundColor: '#fff' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '15px' }}>
            <h1 style={{ fontSize: '24px', margin: 0, color: '#1e40af' }}>📘 Documentação da API - Tracker</h1>
            <p style={{ color: '#666', marginTop: '8px', fontSize: '11px' }}>
              Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>

          {/* Authentication */}
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>🔑 Autenticação</h2>
            <p style={{ marginBottom: '8px' }}>Todas as requisições devem incluir sua API Key no header:</p>
            <PdfCodeBlock>{`curl -H "X-API-Key: sk_live_sua_chave_aqui" \\
     ${API_BASE_URL}?action=client&cpf=12345678901`}</PdfCodeBlock>
            <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '6px', marginTop: '10px', fontSize: '11px' }}>
              <strong>⚠️ Importante:</strong> Nunca exponha sua API Key em código cliente (frontend). Use apenas em servidores backend.
            </div>
          </div>

          {/* Base URL */}
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>🌐 Base URL</h2>
            <p style={{ backgroundColor: '#f0f9ff', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}>
              {API_BASE_URL}
            </p>
          </div>

          {/* Endpoint: Client */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>📋 Endpoint: Buscar Cliente</h2>
            <p><span style={{ backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>GET</span> <code>?action=client</code></p>
            
            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Parâmetros de Busca:</h4>
            <ul style={{ fontSize: '11px', marginLeft: '20px' }}>
              <li><code>cpf</code> - Buscar por CPF/CNPJ</li>
              <li><code>plate</code> - Buscar por placa do veículo</li>
              <li><code>phone</code> - Buscar por telefone</li>
              <li><code>name</code> - Buscar por nome (parcial)</li>
            </ul>

            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Exemplo:</h4>
            <PdfCodeBlock>{`curl -X GET "${API_BASE_URL}?action=client&cpf=12345678901" \\
     -H "X-API-Key: sk_live_xxx"`}</PdfCodeBlock>

            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Resposta:</h4>
            <PdfCodeBlock>{`{
  "success": true,
  "client": {
    "id": "uuid",
    "name": "João Silva",
    "document": "123.456.789-01",
    "phone": "11999999999",
    "email": "joao@email.com",
    "status": "active",
    "payment_status": "em_dia",
    "days_overdue": 0,
    "pending_amount": 0
  },
  "vehicle": {
    "license_plate": "ABC1234",
    "brand": "Fiat",
    "model": "Uno",
    "year": 2020
  }
}`}</PdfCodeBlock>
          </div>

          {/* Endpoint: Vehicles */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>🚗 Endpoint: Veículos</h2>
            <p><span style={{ backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>GET</span> <code>?action=vehicles&client_id=uuid</code></p>
            
            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Parâmetros:</h4>
            <ul style={{ fontSize: '11px', marginLeft: '20px' }}>
              <li><code>client_id</code> - ID do cliente (obrigatório)</li>
            </ul>

            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Exemplo:</h4>
            <PdfCodeBlock>{`curl -X GET "${API_BASE_URL}?action=vehicles&client_id=uuid" \\
     -H "X-API-Key: sk_live_xxx"`}</PdfCodeBlock>
          </div>

          {/* Endpoint: Payments */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>💰 Endpoint: Pagamentos</h2>
            <p><span style={{ backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>GET</span> <code>?action=payments&client_id=uuid</code></p>
            
            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Parâmetros:</h4>
            <ul style={{ fontSize: '11px', marginLeft: '20px' }}>
              <li><code>client_id</code> - ID do cliente (obrigatório)</li>
              <li><code>status</code> - Filtrar por status: pending, paid, overdue</li>
              <li><code>limit</code> - Limite de resultados (padrão: 50)</li>
            </ul>

            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Exemplo:</h4>
            <PdfCodeBlock>{`curl -X GET "${API_BASE_URL}?action=payments&client_id=uuid&status=pending" \\
     -H "X-API-Key: sk_live_xxx"`}</PdfCodeBlock>
          </div>

          {/* Endpoint: Create Charge */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>➕ Endpoint: Criar Cobrança</h2>
            <p><span style={{ backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>POST</span> <code>/</code></p>
            
            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Body (JSON):</h4>
            <PdfCodeBlock>{`{
  "action": "create_charge",
  "client_id": "uuid-do-cliente",
  "amount": 150.00,
  "due_date": "2025-02-01",
  "description": "Mensalidade Fevereiro/2025"
}`}</PdfCodeBlock>

            <h4 style={{ marginTop: '12px', fontSize: '13px' }}>Exemplo cURL:</h4>
            <PdfCodeBlock>{`curl -X POST "${API_BASE_URL}" \\
     -H "X-API-Key: sk_live_xxx" \\
     -H "Content-Type: application/json" \\
     -d '{"action": "create_charge", "client_id": "uuid", "amount": 150.00, "due_date": "2025-02-01"}'`}</PdfCodeBlock>
          </div>

          {/* Error Codes */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>❌ Códigos de Erro</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>Código</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>Nome</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>Descrição</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>401</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Unauthorized</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>API Key não fornecida ou inválida</td></tr>
                <tr><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>403</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Forbidden</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>API Key não tem permissão para esta ação</td></tr>
                <tr><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>404</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Not Found</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Cliente ou recurso não encontrado</td></tr>
                <tr><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>400</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Bad Request</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Parâmetros obrigatórios faltando ou inválidos</td></tr>
                <tr><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>500</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Internal Server Error</td><td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>Erro interno do servidor</td></tr>
              </tbody>
            </table>
          </div>

          {/* JavaScript Example */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>💻 Exemplo JavaScript/Node.js</h2>
            <PdfCodeBlock>{`const API_KEY = 'sk_live_xxx';
const BASE_URL = '${API_BASE_URL}';

async function getClientByCPF(cpf) {
  const response = await fetch(\`\${BASE_URL}?action=client&cpf=\${cpf}\`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return response.json();
}

async function createCharge(clientId, amount, dueDate) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_charge', client_id: clientId, amount, due_date: dueDate })
  });
  return response.json();
}`}</PdfCodeBlock>
          </div>

          {/* Python Example */}
          <div style={{ marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '16px', color: '#1e40af', borderBottom: '1px solid #e5e7eb', paddingBottom: '5px' }}>🐍 Exemplo Python</h2>
            <PdfCodeBlock>{`import requests

API_KEY = 'sk_live_xxx'
BASE_URL = '${API_BASE_URL}'
headers = {'X-API-Key': API_KEY, 'Content-Type': 'application/json'}

def get_client_by_cpf(cpf):
    return requests.get(f'{BASE_URL}?action=client&cpf={cpf}', headers=headers).json()

def create_charge(client_id, amount, due_date):
    return requests.post(BASE_URL, headers=headers, json={
        'action': 'create_charge', 'client_id': client_id, 'amount': amount, 'due_date': due_date
    }).json()`}</PdfCodeBlock>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
            <p>Documentação da API Tracker - Versão 1.0</p>
            <p>Para suporte técnico, entre em contato com nossa equipe.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default ApiDocsPage
