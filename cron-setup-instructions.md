# Configuração do Cron Job para Relatórios Semanais Automáticos

## Problema Identificado
A funcionalidade de envio automático de relatórios semanais não estava funcionando porque não havia um cron job configurado para executar a função automaticamente.

## Solução Implementada

### 1. Edge Function Criada
- **Arquivo**: `supabase/functions/weekly-reports-cron/index.ts`
- **URL**: `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/weekly-reports-cron`
- **Função**: Processa e envia relatórios semanais baseados na configuração da tabela `ai_weekly_reports`

### 2. Configuração do Cron Job Externo

#### Opção 1: CronHost (Recomendado - Gratuito)
1. Acesse: https://cronho.st/
2. Crie uma conta gratuita
3. Configure um novo job com:
   - **Nome**: "Relatórios Semanais VehicleGuard"
   - **URL**: `https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/weekly-reports-cron`
   - **Método**: POST
   - **Cron Expression**: `0 6-22 * * *` (a cada hora das 6h às 22h)
   - **Headers**: 
     - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw`
     - `Content-Type: application/json`

#### Opção 2: EasyCron
1. Acesse: https://www.easycron.com/
2. Crie uma conta gratuita
3. Configure com os mesmos parâmetros acima

#### Opção 3: FastCron
1. Acesse: https://www.fastcron.com/
2. Crie uma conta gratuita
3. Configure com os mesmos parâmetros acima

### 3. Como Funciona

1. **Cron Job Externo** → Chama a edge function a cada hora
2. **Edge Function** → Verifica se há relatórios para enviar baseado em:
   - Dia da semana atual
   - Horário configurado
   - Se já foi enviado hoje
3. **Se encontrar relatórios** → Chama a função `ai-collection` para gerar e enviar via WhatsApp

### 4. Configuração no Sistema

Os usuários podem configurar os relatórios em:
- **Tela**: Configurações → Relatório Semanal Automático
- **Campos**:
  - Ativar/Desativar relatórios
  - Telefones dos gestores
  - Dia da semana
  - Horário de envio

### 5. Monitoramento

- A edge function gera logs detalhados
- Possível acompanhar via Dashboard do Supabase
- O cron job externo também fornece logs de execução

## Status
✅ Edge function criada e deployada
🔄 Cron job externo precisa ser configurado manualmente
⏳ Teste da funcionalidade pendente