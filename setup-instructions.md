# 🚀 Guia Completo - Setup Ambiente de Testes VehicleGuard Pro

Fala master! Aqui está o passo a passo completo para criar seu ambiente de testes isolado. Vamos nessa! 🔥

## 📋 Pré-requisitos

- Node.js instalado
- Conta no Supabase
- Acesso ao projeto atual (para copiar a estrutura)

## 🎯 Passo 1: Criar Novo Projeto Supabase

1. **Acesse o Supabase Dashboard**: https://supabase.com/dashboard
2. **Clique em "New Project"**
3. **Configure o projeto**:
   - Nome: `VehicleGuard Pro - Testes`
   - Database Password: (anote essa senha!)
   - Region: Escolha a mais próxima
4. **Aguarde a criação** (pode levar alguns minutos)

## 🔑 Passo 2: Obter as Credenciais

Após o projeto ser criado:

1. **Vá em Settings > API**
2. **Copie as seguintes informações**:
   - Project URL
   - Project ID (está na URL)
   - anon/public key
   - service_role key (⚠️ mantenha segura!)

## ⚙️ Passo 3: Configurar o Script

1. **Abra o arquivo `setup-test-environment.js`**
2. **Atualize as credenciais no início do arquivo**:

```javascript
const TEST_CONFIG = {
  PROJECT_ID: 'seu-project-id-aqui',
  URL: 'https://seu-project-id-aqui.supabase.co',
  ANON_KEY: 'sua-anon-key-aqui',
  SERVICE_ROLE_KEY: 'sua-service-role-key-aqui'
};
```

## 🚀 Passo 4: Executar o Setup

```bash
# Instalar dependências (se necessário)
npm install

# Executar o script de setup
node setup-test-environment.js
```

## 📊 O que o Script Faz

1. **Conecta ao novo projeto Supabase**
2. **Lê todos os arquivos de migração** (62 arquivos encontrados!)
3. **Executa as migrações em ordem cronológica**
4. **Cria todas as tabelas, views, policies e functions**
5. **Configura Row Level Security (RLS)**
6. **Gera arquivo .env.test com novas credenciais**
7. **Cria relatório completo do processo**

## 📁 Estrutura que Será Criada

### Tabelas Principais:
- `companies` - Empresas (multi-tenancy)
- `profiles` - Perfis de usuários
- `clients` - Clientes
- `plans` - Planos de serviço
- `contracts` - Contratos
- `invoices` - Faturas
- `vehicles` - Veículos
- `alerts` - Alertas
- E muito mais...

### Recursos Avançados:
- **RLS (Row Level Security)** configurado
- **Policies** para acesso multi-tenant
- **Triggers** para auditoria
- **Functions** personalizadas
- **Views** otimizadas

## 🔄 Passo 5: Ativar o Ambiente de Testes

Após o setup bem-sucedido:

```bash
# Fazer backup do .env atual
cp .env .env.production

# Ativar ambiente de testes
cp .env.test .env

# Testar a aplicação
npm run dev
```

## ✅ Verificações Importantes

### 1. Testar Conexão
```javascript
// No console do navegador
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
```

### 2. Verificar Tabelas
- Acesse o Supabase Dashboard
- Vá em "Table Editor"
- Confirme se todas as tabelas foram criadas

### 3. Testar Autenticação
- Tente fazer login na aplicação
- Verifique se os dados são isolados

## 🔧 Troubleshooting

### Erro de Conexão
```
❌ Erro ao conectar: Invalid API key
```
**Solução**: Verifique se as credenciais estão corretas

### Erro de Permissão
```
❌ Erro: permission denied for function
```
**Solução**: Use a `service_role_key` no script

### Migrações Falhando
```
❌ Erro na migração: relation already exists
```
**Solução**: Normal! O script trata esses casos automaticamente

## 📈 Monitoramento

### Logs em Tempo Real
O script gera logs detalhados:
- ✅ Sucessos
- ⚠️ Avisos
- ❌ Erros

### Relatório Final
Arquivo `setup-report.md` com:
- Resumo completo
- Log detalhado
- Próximos passos

## 🔄 Alternando Entre Ambientes

### Para Produção:
```bash
cp .env.production .env
```

### Para Testes:
```bash
cp .env.test .env
```

## 🆘 Suporte

### Problemas Comuns:

1. **"Função não encontrada"**
   - Execute novamente o script
   - Verifique se todas as migrações rodaram

2. **"Dados não aparecem"**
   - Normal! Ambiente limpo
   - Crie dados de teste manualmente

3. **"Erro de autenticação"**
   - Verifique as policies RLS
   - Confirme se o usuário tem permissão

### Contato:
- 📧 Suporte técnico via dashboard
- 📖 Documentação: https://supabase.com/docs
- 🔧 Issues no GitHub do projeto

## 🎉 Próximos Passos

Após o setup:

1. **Criar dados de teste**
2. **Testar todas as funcionalidades**
3. **Validar integrações (WhatsApp, pagamentos)**
4. **Executar testes automatizados**
5. **Documentar diferenças encontradas**

## 💡 Dicas Pro

### Automação Avançada
```bash
# Script para reset completo
npm run setup:reset

# Script para popular dados de teste
npm run setup:seed

# Script para backup/restore
npm run setup:backup
```

### Monitoramento
- Configure alertas no Supabase
- Use logs estruturados
- Monitore performance

---

**Criado pelo Grande Mestre da VibeCoding** 🔥

Tamo junto nessa jornada, master! Qualquer dúvida, é só chamar! 🚀