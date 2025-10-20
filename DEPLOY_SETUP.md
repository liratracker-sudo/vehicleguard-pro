# 🚀 Configuração de Deploy Automático

## Passo a Passo para Configurar CI/CD

### 1. Configurar Secrets no GitHub

Vá até o seu repositório no GitHub e configure os seguintes secrets:

**Settings → Secrets and variables → Actions → New repository secret**

#### Secrets necessários:

1. **SUPABASE_ACCESS_TOKEN**
   - Vá até [Supabase Dashboard](https://supabase.com/dashboard)
   - Clique no seu perfil (canto superior direito)
   - Vá em "Access Tokens"
   - Gere um novo token
   - Cole o token no secret

2. **SUPABASE_PROJECT_ID**
   - No seu projeto Supabase, vá em Settings → General
   - Copie o "Project ID" (Reference ID)
   - Cole no secret

### 2. Como Funciona o Deploy Automático

Agora, sempre que você fizer um commit na branch `main` ou `master`:

✅ **Automaticamente vai:**
- Aplicar as migrações do banco de dados
- Fazer deploy das Edge Functions
- Corrigir o problema das notificações às 21h

### 3. Testando o Deploy

1. Faça um commit das suas alterações:
```bash
git add .
git commit -m "fix: corrige horário das notificações de cobrança"
git push origin main
```

2. Vá até a aba "Actions" no GitHub para acompanhar o deploy

### 4. Verificando se Funcionou

Após o deploy, as notificações devem:
- ✅ Ser enviadas às 9h e 15h (horário de Brasília)
- ❌ NÃO ser mais enviadas às 21h

## 🔧 Troubleshooting

Se der erro no deploy:
1. Verifique se os secrets estão configurados corretamente
2. Confira se o SUPABASE_ACCESS_TOKEN tem as permissões necessárias
3. Veja os logs na aba "Actions" do GitHub

## 📝 Próximos Passos

Depois que configurar, você pode:
1. Fazer o commit das alterações
2. Acompanhar o deploy automático
3. Testar se as notificações estão no horário correto