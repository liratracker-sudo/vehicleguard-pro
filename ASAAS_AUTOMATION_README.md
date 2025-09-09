# Automação de Status de Cobrança - Asaas

## Visão Geral
Este sistema implementa a automação completa do status de cobrança integrado com a API do Asaas, incluindo atualizações em tempo real e sincronização automática.

## Funcionalidades Implementadas

### 1. Webhook Asaas (Tempo Real)
- **Função**: `asaas-webhook` (supabase/functions/asaas-webhook/index.ts)
- **Eventos Suportados**:
  - `PAYMENT_RECEIVED` → Status: "paid"
  - `PAYMENT_CONFIRMED` → Status: "paid" 
  - `PAYMENT_OVERDUE` → Status: "overdue"
  - `PAYMENT_DELETED` → Status: "cancelled"
  - `PAYMENT_REFUNDED` → Status: "cancelled"
  - `PAYMENT_CREATED` → Status: "pending"
  - `PAYMENT_AWAITING_PAYMENT` → Status: "pending"

- **Segurança**: Validação por token de autenticação
- **Logs**: Registra todas as operações na tabela `asaas_logs`
- **Endpoint**: Público (sem JWT) para receber webhooks do Asaas

### 2. Sincronização Automática (Fallback)
- **Função**: `asaas-sync-payments` (supabase/functions/asaas-sync-payments/index.ts)
- **Execução**: A cada 15 minutos via cron job
- **Objetivo**: Sincronizar pagamentos pendentes/vencidos que não foram atualizados via webhook
- **Processo**:
  1. Busca empresas com integração Asaas ativa
  2. Para cada empresa, consulta pagamentos pendentes/vencidos
  3. Faz requisição à API Asaas para verificar status atual
  4. Atualiza status local se houver diferença

### 3. Atualizações em Tempo Real na UI
- **Hook**: `useAsaasRealtime` (src/hooks/useAsaasRealtime.ts)
- **Tecnologia**: Supabase Realtime subscriptions
- **Funcionalidades**:
  - Escuta mudanças na tabela `payment_transactions`
  - Mostra notificações toast quando status muda
  - Permite sincronização manual
  - Indica status da conexão

### 4. Componente de Status
- **Componente**: `AsaasStatusIndicator` (src/components/billing/AsaasStatusIndicator.tsx)
- **Localização**: Página de cobranças (Billing)
- **Recursos**:
  - Indicador de conexão em tempo real
  - Botão de sincronização manual
  - Histórico da última atualização
  - Visual dos status de pagamento

### 5. Configuração Automática do Webhook
- **Hook**: `useEnsureAsaasWebhook` (src/hooks/useEnsureAsaasWebhook.ts)
- **Execução**: Uma vez por sessão da aplicação
- **Função**: Garante que o webhook está configurado no Asaas automaticamente

## Fluxo de Funcionamento

### Cenário 1: Pagamento Processado (Tempo Real)
1. Cliente efetua pagamento no Asaas
2. Asaas envia webhook para `asaas-webhook`
3. Sistema valida token e atualiza status no banco
4. Realtime subscription detecta mudança
5. UI atualiza automaticamente
6. Toast notification é exibida

### Cenário 2: Fallback (Sincronização Automática)
1. Cron job executa a cada 15 minutos
2. Função `asaas-sync-payments` é chamada
3. Sistema consulta API Asaas para pagamentos pendentes
4. Compara status local vs. Asaas
5. Atualiza status se necessário
6. UI recebe atualização via realtime

### Cenário 3: Sincronização Manual
1. Usuário clica no botão "Sync" no indicador
2. Função `triggerSync` é chamada
3. Executa `asaas-sync-payments` imediatamente
4. Toast mostra resultado da sincronização

## Configuração do Banco de Dados

### Realtime Habilitado
```sql
-- Habilita realtime para payment_transactions
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
```

### Cron Job Configurado
```sql
-- Execução a cada 15 minutos
SELECT cron.schedule(
  'asaas-sync-payments',
  '*/15 * * * *',
  'SELECT net.http_post(...)'
);
```

## Monitoramento e Logs

### Logs do Asaas
- Tabela: `asaas_logs`
- Registra: Webhooks, sincronizações, erros
- Campos: company_id, operation_type, status, request_data, response_data

### Logs de Edge Functions
- Acesso via Supabase Dashboard
- Monitoramento de erros e performance
- Debugging de webhook e sync

## Tratamento de Erros

### Webhook Asaas
- Validação de token obrigatória
- Logs de erro automáticos
- Resposta HTTP apropriada para evitar retentativas desnecessárias

### Sincronização
- Erro em uma empresa não afeta outras
- Retry automático via cron job
- Logs detalhados para debugging

## Interface do Usuário

### Indicador de Status
- **Verde**: Conexão ativa, recebendo atualizações
- **Cinza**: Offline, use sincronização manual
- **Último Update**: Mostra última mudança de status
- **Botão Sync**: Força sincronização imediata

### Notifications
- Toasts automáticos para mudanças de status
- Diferenciação visual por tipo de status
- Valores formatados em reais

## Requisitos Atendidos

✅ **Webhook Asaas configurado** - Eventos PAYMENT_RECEIVED e PAYMENT_CONFIRMED  
✅ **Endpoint backend /webhook/asaas** - Validação de eventos implementada  
✅ **Atualização automática do status** - Via external_id do payment  
✅ **Atualização em tempo real** - Supabase realtime subscriptions  
✅ **Rotina de fallback** - Cron job a cada 15 minutos  
✅ **Interface visual** - Indicador e notifications implementados  

## Como Testar

1. Configure integração Asaas nas configurações
2. Crie uma cobrança no sistema
3. Efetue pagamento via PIX/boleto no Asaas
4. Observe atualização automática na tela
5. Use botão "Sync" para forçar sincronização manual

## Troubleshooting

### Webhook não funciona
- Verifique se token está configurado corretamente
- Consulte logs da função `asaas-webhook`
- Confirme URL do webhook no painel Asaas

### Sincronização falha
- Verifique logs da função `asaas-sync-payments`
- Confirme que cron job está ativo
- Teste chamada manual da função

### Realtime não atualiza
- Confirme que subscription está ativa no console
- Verifique se tabela está na publicação realtime
- Teste conexão de rede do cliente