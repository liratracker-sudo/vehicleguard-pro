# 📋 INSTRUÇÕES PARA RESTAURAR O BANCO DE DADOS

## ⚠️ IMPORTANTE
- **TODOS OS DADOS ATUAIS SERÃO PERDIDOS** (você está no plano Free, sem backup automático)
- Este script recria APENAS a estrutura do banco (tabelas, políticas, funções)
- Os dados cadastrados precisarão ser reinseridos manualmente após a restauração

---

## 🔧 PASSO A PASSO

### 1️⃣ Acesse o SQL Editor do Supabase

Clique no link abaixo para abrir o SQL Editor:
**[Abrir SQL Editor do Supabase](https://supabase.com/dashboard/project/mcdidffxwtnqhawqilln/sql/new)**

---

### 2️⃣ Copie o Script SQL

1. Abra o arquivo `RESTORE_DATABASE.sql` (está na raiz do projeto)
2. Copie **TODO** o conteúdo do arquivo (Ctrl+A, Ctrl+C)

---

### 3️⃣ Cole e Execute o Script

1. No SQL Editor do Supabase, **cole** todo o script SQL
2. Clique no botão **"Run"** (executar) no canto inferior direito
3. **Aguarde** a execução completa (pode levar 30-60 segundos)

---

### 4️⃣ Verifique se Funcionou

Após executar, você deve ver:
- ✅ Mensagem de sucesso "Success" na parte inferior
- ✅ Nenhum erro vermelho
- ✅ No menu lateral esquerdo: `Tables` deve mostrar suas tabelas restauradas

---

### 5️⃣ Crie um Novo Usuário Admin

Depois da restauração, você precisará:

1. Acessar a tela de **Auth** do Supabase:
   **[Criar Usuário](https://supabase.com/dashboard/project/mcdidffxwtnqhawqilln/auth/users)**

2. Clique em **"Add user"** e crie um novo usuário com:
   - Email
   - Senha temporária

3. Depois de criar o usuário, você precisará inserir dados na tabela `profiles` e `user_roles` manualmente via SQL Editor:

```sql
-- Substitua USER_ID pelo ID do usuário criado no Auth
-- Substitua COMPANY_ID pelo ID da empresa (você pode criar uma empresa primeiro)

-- Criar uma empresa
INSERT INTO public.companies (name, slug, email, phone) 
VALUES ('Minha Empresa', 'minha-empresa', 'contato@minhaempresa.com', '(11) 99999-9999')
RETURNING id; -- Anote o ID retornado

-- Criar perfil do usuário (use o USER_ID do Auth e o COMPANY_ID acima)
INSERT INTO public.profiles (user_id, company_id, full_name, email, role, is_active)
VALUES ('USER_ID_AQUI', 'COMPANY_ID_AQUI', 'Seu Nome', 'seu@email.com', 'admin', true);

-- Criar role de super_admin (use o USER_ID do Auth)
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_AQUI', 'super_admin');
```

---

## 🎯 O QUE FOI RESTAURADO

Este script recria:
- ✅ 40+ tabelas do sistema
- ✅ Todas as políticas RLS (Row Level Security)
- ✅ Triggers automáticos
- ✅ Funções de criptografia
- ✅ Índices para performance
- ✅ Sistema de notificações
- ✅ Integrações (Asaas, Inter, Gerencianet, Assinafy)
- ✅ Sistema de IA e alertas
- ✅ Sistema administrativo e white-label

---

## ❌ SE DER ERRO

Se aparecer algum erro durante a execução:

1. **Limpe o editor** (delete todo o conteúdo)
2. **Cole o script novamente**
3. **Execute novamente**

Se persistir, anote a mensagem de erro e me envie.

---

## 📞 PRECISA DE AJUDA?

Se tiver dúvidas ou problemas:
1. Copie a mensagem de erro exata
2. Tire um print da tela
3. Me envie aqui no chat

---

## ⏭️ PRÓXIMOS PASSOS APÓS RESTAURAÇÃO

1. ✅ Criar usuário admin (instruções acima)
2. ✅ Fazer login no sistema
3. ✅ Recadastrar clientes
4. ✅ Recadastrar veículos
5. ✅ Reconfigurar integrações (WhatsApp, Asaas, etc.)
6. ✅ Recadastrar planos e contratos

---

**Boa sorte! 🚀**