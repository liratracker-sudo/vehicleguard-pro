
# Plano: Documentação Completa da API para Integração com Traccar

## Situação Atual

O sistema já possui uma API funcional (`tracker-api`) com os seguintes endpoints:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `?action=client` | GET | Buscar cliente por CPF, placa, telefone ou nome |
| `?action=vehicles` | GET | Listar veículos de um cliente |
| `?action=payments` | GET | Listar pagamentos de um cliente |
| `action: create_charge` | POST | Criar cobrança |
| `action: update_charge` | POST | Atualizar cobrança |

## O que Falta para Integração com Traccar

Para integrar com Traccar de forma completa (sincronização de clientes e **bloqueio automático**), precisamos adicionar:

1. **Endpoint para listar clientes inadimplentes** - Permite ao Traccar verificar periodicamente quais usuários devem ser bloqueados
2. **Endpoint para listar todos os clientes/veículos** - Sincronização inicial
3. **Link público da documentação** - Acessível externamente para uso com IA

## Arquitetura de Integração

```text
┌─────────────────────────────────────────────────────────────┐
│                  Seu Sistema de Gestão                      │
│              (VehicleGuard Pro - API REST)                  │
│                                                             │
│  Endpoints Existentes:                                      │
│  • GET ?action=client (busca por CPF/placa/telefone)        │
│  • GET ?action=vehicles (veículos de um cliente)            │
│  • GET ?action=payments (pagamentos de um cliente)          │
│  • POST create_charge / update_charge                       │
│                                                             │
│  NOVOS Endpoints (a implementar):                           │
│  • GET ?action=overdue_clients (inadimplentes)              │
│  • GET ?action=all_clients (todos clientes ativos)          │
│  • GET ?action=sync_vehicles (todos veículos + status)      │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  │  API REST (JSON)
                                  │  Header: X-API-Key
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                        TRACCAR                              │
│                                                             │
│  1. Consulta overdue_clients periodicamente (cron)          │
│  2. Para cada cliente inadimplente:                         │
│     - Bloqueia usuário no Traccar via API Traccar           │
│     - Desabilita dispositivos associados                    │
│                                                             │
│  3. Quando pagamento é confirmado:                          │
│     - Seu sistema pode ter webhook para notificar           │
│     - Ou Traccar consulta novamente para reativar           │
└─────────────────────────────────────────────────────────────┘
```

## Novos Endpoints a Implementar

### 1. Listar Clientes Inadimplentes
```
GET ?action=overdue_clients&days_min=1&days_max=90
```

Resposta:
```json
{
  "success": true,
  "clients": [
    {
      "id": "uuid",
      "name": "João Silva",
      "document": "12345678901",
      "phone": "11999999999",
      "days_overdue": 15,
      "pending_amount": 300.00,
      "should_block": true,
      "vehicles": [
        {
          "id": "uuid",
          "license_plate": "ABC1234",
          "tracker_device_id": "DEV123"
        }
      ]
    }
  ]
}
```

### 2. Sincronização de Veículos
```
GET ?action=sync_vehicles
```

Resposta:
```json
{
  "success": true,
  "vehicles": [
    {
      "id": "uuid",
      "license_plate": "ABC1234",
      "tracker_device_id": "DEV123",
      "tracker_status": "active",
      "client_id": "uuid",
      "client_name": "João Silva",
      "client_document": "12345678901",
      "payment_status": "em_dia",
      "days_overdue": 0,
      "should_block": false
    }
  ]
}
```

### 3. Registrar Bloqueio no Sistema
```
POST action: "register_block"
```

Body:
```json
{
  "action": "register_block",
  "vehicle_id": "uuid",
  "blocked": true,
  "blocked_by": "traccar_sync",
  "reason": "Inadimplência - 15 dias"
}
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/tracker-api/index.ts` | Adicionar endpoints: `overdue_clients`, `sync_vehicles`, `register_block` |
| `src/pages/ApiDocs.tsx` | Adicionar documentação dos novos endpoints |
| Criar `src/pages/PublicApiDocs.tsx` | Página pública de documentação (sem login) |
| `src/App.tsx` | Adicionar rota pública `/docs/api` |

## Implementação dos Novos Endpoints

### 1. `overdue_clients` - Lista todos inadimplentes

```typescript
async function handleGetOverdueClients(supabase: any, companyId: string, params: URLSearchParams) {
  const daysMin = parseInt(params.get('days_min') || '1')
  const daysMax = parseInt(params.get('days_max') || '9999')
  
  // Busca todos os pagamentos vencidos com clientes e veículos
  const { data: overduePayments } = await supabase
    .from('payment_transactions')
    .select(`
      id, amount, due_date, status,
      clients!inner(id, name, document, phone, status)
    `)
    .eq('company_id', companyId)
    .in('status', ['pending', 'overdue'])
    .lt('due_date', new Date().toISOString().split('T')[0])
  
  // Agrupa por cliente e calcula dias de atraso
  const clientMap = new Map()
  
  for (const payment of overduePayments || []) {
    const daysOverdue = calculateDaysOverdue(payment.due_date)
    
    if (daysOverdue >= daysMin && daysOverdue <= daysMax) {
      const clientId = payment.clients.id
      
      if (!clientMap.has(clientId)) {
        // Busca veículos do cliente
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, license_plate, tracker_device_id, tracker_status')
          .eq('client_id', clientId)
        
        clientMap.set(clientId, {
          ...payment.clients,
          days_overdue: daysOverdue,
          pending_amount: payment.amount,
          should_block: daysOverdue > 5, // Configável
          vehicles: vehicles || []
        })
      } else {
        const existing = clientMap.get(clientId)
        existing.pending_amount += payment.amount
        existing.days_overdue = Math.max(existing.days_overdue, daysOverdue)
      }
    }
  }
  
  return successResponse({
    clients: Array.from(clientMap.values())
  })
}
```

### 2. `sync_vehicles` - Todos veículos com status de pagamento

```typescript
async function handleSyncVehicles(supabase: any, companyId: string) {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select(`
      id, license_plate, tracker_device_id, tracker_status,
      brand, model, year,
      clients!inner(id, name, document, phone)
    `)
    .eq('company_id', companyId)
  
  const result = []
  
  for (const vehicle of vehicles || []) {
    // Busca status de pagamento do cliente
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('amount, due_date, status')
      .eq('client_id', vehicle.clients.id)
      .in('status', ['pending', 'overdue'])
    
    const paymentInfo = calculatePaymentStatus(payments || [])
    
    result.push({
      id: vehicle.id,
      license_plate: vehicle.license_plate,
      tracker_device_id: vehicle.tracker_device_id,
      tracker_status: vehicle.tracker_status,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      client_id: vehicle.clients.id,
      client_name: vehicle.clients.name,
      client_document: vehicle.clients.document,
      payment_status: paymentInfo.status,
      days_overdue: paymentInfo.days_overdue,
      pending_amount: paymentInfo.pending_amount,
      should_block: paymentInfo.days_overdue > 5
    })
  }
  
  return successResponse({ vehicles: result })
}
```

## Página de Documentação Pública

Criar uma página acessível em `/docs/api` (sem necessidade de login) que pode ser compartilhada com a IA do Antigravity:

**URL Pública da Documentação:**
```
https://vehicleguard-pro.lovable.app/docs/api
```

Esta página conterá:
- Todos os endpoints disponíveis
- Exemplos de uso em JavaScript/Python
- Fluxo recomendado para bloqueio automático no Traccar
- Botão para baixar PDF

## Fluxo de Bloqueio Automático no Traccar

O Traccar pode implementar o seguinte fluxo:

```text
1. CRON a cada hora no Traccar:
   GET /tracker-api?action=overdue_clients&days_min=5
   
2. Para cada cliente retornado com should_block=true:
   - Localizar usuário no Traccar por document ou email
   - Desabilitar usuário: PUT /api/users/{id} { disabled: true }
   - Desabilitar dispositivos: PUT /api/devices/{id} { disabled: true }
   
3. Quando o cliente pagar:
   - Webhook do seu sistema notifica Traccar
   - OU: Traccar consulta novamente e vê should_block=false
   - Reativa usuário e dispositivos
```

## Etapas de Implementação

1. Adicionar novos handlers no `tracker-api`:
   - `handleGetOverdueClients`
   - `handleSyncVehicles`
   - `handleRegisterBlock`

2. Atualizar switch case para novos actions

3. Criar página `PublicApiDocs.tsx` com documentação completa

4. Adicionar rota pública no `App.tsx`

5. Deploy e teste

6. Gerar link da documentação:
   **https://vehicleguard-pro.lovable.app/docs/api**

## Link Final para Antigravity

Após implementação, você poderá compartilhar este link com a IA do Antigravity:

```
https://vehicleguard-pro.lovable.app/docs/api
```

A IA poderá ler a documentação e ajudar a implementar a integração do lado do Traccar.
