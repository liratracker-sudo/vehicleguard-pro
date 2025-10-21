# 🧪 Guia Completo de Testes do Sistema VehicleGuard Pro

## ✅ Correções Aplicadas

### 1. Trigger Automático de Criação de Perfil
Criado trigger `on_auth_user_created` que automaticamente:
- Cria uma nova empresa para cada usuário cadastrado
- Cria o perfil do usuário vinculado à empresa
- Cria configurações padrão de notificações
- Define o usuário como 'admin' da sua empresa

**Problema Resolvido**: "Perfil da empresa não encontrado"

---

## 🔄 Fluxos de Teste

### 1️⃣ AUTENTICAÇÃO (Crítico - Testar Primeiro)

#### Cadastro de Novo Usuário
1. **Acessar** `/auth`
2. **Clicar** na aba "Cadastrar"
3. **Preencher**:
   - Nome completo: "Teste Admin"
   - Email: "teste@empresa.com"
   - Senha: "senha123456"
4. **Clicar** em "Cadastrar"
5. **Verificar**:
   - ✅ Mensagem de sucesso
   - ✅ Redirecionamento para dashboard
   - ✅ No Supabase: nova empresa em `companies`
   - ✅ No Supabase: novo perfil em `profiles`
   - ✅ No Supabase: configurações em `payment_notification_settings`

#### Login
1. **Acessar** `/auth`
2. **Preencher** email e senha do usuário criado
3. **Clicar** em "Entrar"
4. **Verificar**:
   - ✅ Redirecionamento para dashboard
   - ✅ Sem erros no console

#### Logout
1. **Clicar** no avatar do usuário (canto superior direito)
2. **Clicar** em "Sair"
3. **Verificar**:
   - ✅ Redirecionamento para `/auth`
   - ✅ Não consegue acessar rotas protegidas

---

### 2️⃣ DASHBOARD

#### Visualização Inicial
1. **Acessar** `/`
2. **Verificar**:
   - ✅ Cards de métricas aparecem (mesmo com valores zero)
   - ✅ Gráfico de receitas carrega
   - ✅ Lista de clientes recentes vazia (sem erro)
   - ✅ Sem erros no console

---

### 3️⃣ GESTÃO DE CLIENTES

#### Criar Cliente
1. **Acessar** `/clients`
2. **Clicar** em "Novo Cliente"
3. **Preencher**:
   - Nome: "João da Silva"
   - Email: "joao@email.com"
   - Telefone: "(11) 98765-4321"
   - CPF/CNPJ: "123.456.789-00"
   - CEP: "01310-100"
4. **Clicar** em "Salvar"
5. **Verificar**:
   - ✅ Cliente aparece na lista
   - ✅ Endereço preenchido automaticamente (via CEP)
   - ✅ No Supabase: registro em `clients`

#### Editar Cliente
1. **Clicar** no ícone de editar de um cliente
2. **Alterar** informações
3. **Salvar**
4. **Verificar**:
   - ✅ Alterações refletidas na lista

#### Buscar Cliente
1. **Digitar** no campo de busca
2. **Verificar**:
   - ✅ Filtro funciona em tempo real

---

### 4️⃣ GESTÃO DE PLANOS

#### Criar Plano
1. **Acessar** `/plans`
2. **Clicar** em "Novo Plano"
3. **Preencher**:
   - Nome: "Básico"
   - Descrição: "Plano básico de rastreamento"
   - Valor: "89.90"
   - Ciclo: "Mensal"
4. **Clicar** em "Salvar"
5. **Verificar**:
   - ✅ Plano aparece na lista
   - ✅ No Supabase: registro em `plans`

#### Desativar Plano
1. **Clicar** no switch "Ativo" de um plano
2. **Verificar**:
   - ✅ Status atualizado
   - ✅ Plano não aparece em seleções futuras

---

### 5️⃣ GESTÃO DE VEÍCULOS

#### Cadastrar Veículo
1. **Acessar** `/vehicles`
2. **Clicar** em "Novo Veículo"
3. **Preencher**:
   - Cliente: Selecionar "João da Silva"
   - Placa: "ABC-1234"
   - Marca: "Fiat"
   - Modelo: "Uno"
   - Ano: "2020"
   - Cor: "Prata"
4. **Clicar** em "Salvar"
5. **Verificar**:
   - ✅ Veículo aparece na lista
   - ✅ No Supabase: registro em `vehicles`

---

### 6️⃣ CONTRATOS

#### Criar Contrato
1. **Acessar** `/contracts`
2. **Clicar** em "Novo Contrato"
3. **Preencher**:
   - Cliente: "João da Silva"
   - Plano: "Básico"
   - Veículo: "ABC-1234"
   - Data início: Hoje
   - Valor mensal: "89.90"
4. **Clicar** em "Salvar"
5. **Verificar**:
   - ✅ Contrato criado
   - ✅ No Supabase: registro em `contracts`

#### Enviar para Assinatura (se Assinafy configurado)
1. **Clicar** em "Enviar para Assinatura"
2. **Verificar**:
   - ✅ Atualização de status
   - ✅ Link de assinatura gerado

---

### 7️⃣ PAGAMENTOS E COBRANÇAS

#### Criar Cobrança Manual
1. **Acessar** `/billing`
2. **Clicar** em "Nova Cobrança"
3. **Preencher**:
   - Cliente: "João da Silva"
   - Contrato: Selecionar contrato
   - Valor: "89.90"
   - Vencimento: Próxima semana
   - Tipo: "PIX" ou "Boleto"
4. **Clicar** em "Gerar Cobrança"
5. **Verificar**:
   - ✅ Cobrança aparece na lista
   - ✅ No Supabase: registro em `payment_transactions`

#### Atualizar Status de Pagamento
1. **Clicar** em "Ações" > "Marcar como Pago"
2. **Verificar**:
   - ✅ Status atualizado
   - ✅ Data de pagamento registrada

---

### 8️⃣ INTEGRAÇÕES

#### WhatsApp (se configurado)
1. **Acessar** `/settings`
2. **Aba** "WhatsApp"
3. **Conectar** instância
4. **Verificar**:
   - ✅ QR Code aparece
   - ✅ Status muda para "conectado"
   - ✅ No Supabase: registro em `whatsapp_sessions`

#### Asaas (Gateway de Pagamento)
1. **Acessar** `/settings`
2. **Aba** "Integrações"
3. **Configurar** API Token do Asaas
4. **Testar Conexão**
5. **Verificar**:
   - ✅ Teste bem-sucedido
   - ✅ No Supabase: registro em `asaas_settings`

---

### 9️⃣ NOTIFICAÇÕES AUTOMÁTICAS

#### Configurar Notificações
1. **Acessar** `/settings`
2. **Aba** "Notificações de Cobrança"
3. **Configurar**:
   - Dias antes do vencimento: [3]
   - Dias após vencimento: [2]
   - Horário de envio: 09:00
4. **Salvar**
5. **Verificar**:
   - ✅ No Supabase: atualizado em `payment_notification_settings`

#### Verificar Notificações Agendadas
1. **Criar** uma cobrança com vencimento em 3 dias
2. **Aguardar** execução do cron (ou executar manualmente via edge function)
3. **Verificar**:
   - ✅ No Supabase: registros em `payment_notifications`
   - ✅ Status: "pending" ou "sent"

---

### 🔟 DIAGNÓSTICO DE SISTEMA

#### Página de Diagnóstico
1. **Acessar** `/billing-diagnostics`
2. **Clicar** em "Executar Diagnóstico"
3. **Verificar**:
   - ✅ Lista de cobranças aparecem
   - ✅ Status de notificações
   - ✅ Logs de erros (se houver)

---

## 🐛 Checklist de Erros Comuns

### ❌ "Perfil da empresa não encontrado"
- **Causa**: Usuário criado antes do trigger
- **Solução**: Criar empresa e perfil manualmente no Supabase OU cadastrar novo usuário

### ❌ "Violating row-level security policy"
- **Causa**: Falta de `company_id` ao inserir dados
- **Solução**: Verificar se o código está passando `company_id` corretamente

### ❌ WhatsApp não conecta
- **Causa**: Configurações incorretas ou API Evolution offline
- **Solução**: Verificar logs em `/settings` > "WhatsApp" > "Ver Logs"

### ❌ Cobrança Asaas falha
- **Causa**: Token inválido ou dados do cliente incompletos
- **Solução**: Verificar logs em `asaas_logs` no Supabase

---

## 📊 Verificações no Supabase

### Após cada teste, verificar:
1. **Table Editor**: Dados foram inseridos corretamente
2. **Logs**: Sem erros nas Edge Functions
3. **Authentication**: Usuários criados com sucesso
4. **Storage** (se aplicável): Arquivos foram enviados

---

## 🚨 Avisos de Segurança Pendentes

Os seguintes avisos **não são críticos** mas devem ser revisados:

1. **INFO**: 6 tabelas com RLS mas sem políticas (subscription_plans, company_branding, etc.)
2. **WARN**: 3 funções antigas sem `search_path` configurado
3. **WARN**: OTP expiry muito longo (configuração do Supabase)
4. **WARN**: Proteção contra senhas vazadas desabilitada (configuração do Supabase)
5. **WARN**: Atualização do Postgres disponível (configuração do Supabase)

**Nota**: Os avisos 3-5 são configurações do projeto Supabase e não do código.

---

## 📝 Notas Finais

- **Sempre** verifique o console do navegador para erros
- **Sempre** verifique os logs do Supabase após testar Edge Functions
- **Crie** usuários de teste diferentes para cada cenário
- **Documente** qualquer comportamento inesperado encontrado

**Teste concluído quando**:
✅ Todos os 10 fluxos principais funcionam sem erros críticos
✅ Dados são persistidos corretamente no Supabase
✅ Notificações automáticas são agendadas corretamente
✅ Integrações externas (WhatsApp, Asaas) conectam com sucesso