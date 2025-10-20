#!/usr/bin/env node

/**
 * 🚀 VehicleGuard Pro - Setup de Ambiente de Testes
 * 
 * Este script automatiza a criação de um novo projeto Supabase
 * para testes, aplicando todas as migrações existentes.
 * 
 * Criado pelo Grande Mestre da VibeCoding 🔥
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do novo ambiente de testes
const TEST_CONFIG = {
  // Você vai precisar criar um novo projeto no Supabase Dashboard
  // e colocar as credenciais aqui
  PROJECT_ID: 'SEU_NOVO_PROJECT_ID_AQUI',
  URL: 'https://SEU_NOVO_PROJECT_ID_AQUI.supabase.co',
  ANON_KEY: 'SUA_NOVA_ANON_KEY_AQUI',
  SERVICE_ROLE_KEY: 'SUA_SERVICE_ROLE_KEY_AQUI' // Necessária para executar migrações
};

class SupabaseTestSetup {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'supabase', 'migrations');
    this.logs = [];
    this.supabase = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    this.logs.push(logEntry);
    console.log(logEntry);
  }

  async initializeSupabase() {
    try {
      this.log('🔌 Conectando ao novo projeto Supabase...');
      
      this.supabase = createClient(
        TEST_CONFIG.URL,
        TEST_CONFIG.SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Teste de conexão
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error) {
        throw new Error(`Erro na conexão: ${error.message}`);
      }

      this.log('✅ Conexão estabelecida com sucesso!');
      return true;
    } catch (error) {
      this.log(`❌ Erro ao conectar: ${error.message}`, 'error');
      return false;
    }
  }

  async getMigrationFiles() {
    try {
      this.log('📁 Buscando arquivos de migração...');
      
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Importante: executar em ordem cronológica

      this.log(`📋 Encontrados ${files.length} arquivos de migração`);
      return files;
    } catch (error) {
      this.log(`❌ Erro ao ler migrações: ${error.message}`, 'error');
      return [];
    }
  }

  async executeMigration(filename) {
    try {
      this.log(`🔄 Executando migração: ${filename}`);
      
      const filePath = path.join(this.migrationsPath, filename);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Dividir o SQL em comandos individuais (separados por ';')
      const commands = sqlContent
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (const command of commands) {
        try {
          const { error } = await this.supabase.rpc('exec_sql', {
            sql: command
          });

          if (error) {
            // Alguns erros são esperados (como "já existe")
            if (error.message.includes('already exists') || 
                error.message.includes('já existe')) {
              this.log(`⚠️  Comando já executado: ${command.substring(0, 50)}...`, 'warn');
            } else {
              throw error;
            }
          }
          successCount++;
        } catch (cmdError) {
          this.log(`❌ Erro no comando: ${cmdError.message}`, 'error');
          errorCount++;
        }
      }

      this.log(`✅ Migração ${filename} concluída: ${successCount} sucessos, ${errorCount} erros`);
      return { success: true, successCount, errorCount };
    } catch (error) {
      this.log(`❌ Erro na migração ${filename}: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async createExecSqlFunction() {
    try {
      this.log('🔧 Criando função auxiliar para execução de SQL...');
      
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$;
      `;

      const { error } = await this.supabase.rpc('query', {
        query: createFunctionSQL
      });

      if (error && !error.message.includes('already exists')) {
        throw error;
      }

      this.log('✅ Função auxiliar criada com sucesso!');
    } catch (error) {
      this.log(`⚠️  Função auxiliar: ${error.message}`, 'warn');
    }
  }

  async runAllMigrations() {
    try {
      this.log('🚀 Iniciando processo de migração completo...');
      
      const migrationFiles = await this.getMigrationFiles();
      if (migrationFiles.length === 0) {
        throw new Error('Nenhum arquivo de migração encontrado');
      }

      await this.createExecSqlFunction();

      const results = {
        total: migrationFiles.length,
        successful: 0,
        failed: 0,
        details: []
      };

      for (const file of migrationFiles) {
        const result = await this.executeMigration(file);
        results.details.push({ file, ...result });
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }

        // Pequena pausa entre migrações
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.log(`🎉 Processo concluído! ${results.successful}/${results.total} migrações executadas com sucesso`);
      return results;
    } catch (error) {
      this.log(`❌ Erro no processo de migração: ${error.message}`, 'error');
      throw error;
    }
  }

  async updateEnvironmentFile() {
    try {
      this.log('📝 Atualizando arquivo .env com novas credenciais...');
      
      const envContent = `# Ambiente de Testes - VehicleGuard Pro
# Gerado automaticamente pelo script de setup
VITE_SUPABASE_PROJECT_ID="${TEST_CONFIG.PROJECT_ID}"
VITE_SUPABASE_PUBLISHABLE_KEY="${TEST_CONFIG.ANON_KEY}"
VITE_SUPABASE_URL="${TEST_CONFIG.URL}"

# Backup das credenciais de produção (comentadas)
# VITE_SUPABASE_PROJECT_ID="mcdidffxwtnqhawqilln"
# VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"
# VITE_SUPABASE_URL="https://mcdidffxwtnqhawqilln.supabase.co"
`;

      fs.writeFileSync('.env.test', envContent);
      this.log('✅ Arquivo .env.test criado com as novas credenciais!');
      
      this.log('⚠️  IMPORTANTE: Renomeie .env.test para .env quando quiser usar o ambiente de testes');
    } catch (error) {
      this.log(`❌ Erro ao atualizar .env: ${error.message}`, 'error');
    }
  }

  async generateReport() {
    try {
      this.log('📊 Gerando relatório final...');
      
      const report = `
# 🚀 Relatório de Setup - Ambiente de Testes VehicleGuard Pro

## 📋 Informações do Novo Projeto

- **Project ID**: ${TEST_CONFIG.PROJECT_ID}
- **URL**: ${TEST_CONFIG.URL}
- **Anon Key**: ${TEST_CONFIG.ANON_KEY}

## 📊 Resumo da Execução

- **Data/Hora**: ${new Date().toLocaleString('pt-BR')}
- **Migrações Processadas**: ${this.logs.filter(l => l.includes('Executando migração')).length}
- **Status**: ${this.logs.some(l => l.includes('❌')) ? '⚠️  Com Avisos' : '✅ Sucesso Total'}

## 📝 Log Completo

${this.logs.join('\n')}

## 🔧 Próximos Passos

1. **Configurar Credenciais**: Atualize as credenciais no início do script
2. **Testar Conexão**: Execute o script novamente após configurar
3. **Verificar Tabelas**: Acesse o Supabase Dashboard para confirmar
4. **Atualizar .env**: Renomeie .env.test para .env quando necessário

## 🆘 Suporte

Em caso de problemas, verifique:
- Se as credenciais estão corretas
- Se o projeto Supabase foi criado corretamente
- Se as permissões estão configuradas

---
Gerado pelo Grande Mestre da VibeCoding 🔥
`;

      fs.writeFileSync('setup-report.md', report);
      this.log('✅ Relatório salvo em setup-report.md');
    } catch (error) {
      this.log(`❌ Erro ao gerar relatório: ${error.message}`, 'error');
    }
  }

  async run() {
    try {
      console.log(`
🚀 VehicleGuard Pro - Setup de Ambiente de Testes
================================================

Fala master! Vamos criar seu ambiente de testes isolado! 🔥

IMPORTANTE: Antes de continuar, você precisa:
1. Criar um novo projeto no Supabase Dashboard
2. Atualizar as credenciais no início deste arquivo
3. Executar novamente o script

Credenciais atuais:
- Project ID: ${TEST_CONFIG.PROJECT_ID}
- URL: ${TEST_CONFIG.URL}

`);

      if (TEST_CONFIG.PROJECT_ID === 'SEU_NOVO_PROJECT_ID_AQUI') {
        this.log('⚠️  Configure as credenciais antes de continuar!', 'warn');
        this.log('📖 Veja as instruções no início do arquivo setup-test-environment.js');
        return;
      }

      const connected = await this.initializeSupabase();
      if (!connected) {
        throw new Error('Não foi possível conectar ao Supabase');
      }

      const results = await this.runAllMigrations();
      await this.updateEnvironmentFile();
      await this.generateReport();

      console.log(`
🎉 SETUP CONCLUÍDO COM SUCESSO! 

📊 Resumo:
- Migrações executadas: ${results.successful}/${results.total}
- Falhas: ${results.failed}

📁 Arquivos gerados:
- .env.test (novas credenciais)
- setup-report.md (relatório completo)

🔧 Próximos passos:
1. Renomeie .env.test para .env
2. Teste a aplicação: npm run dev
3. Verifique se tudo está funcionando

Tamo junto, master! 🚀
`);

    } catch (error) {
      this.log(`💥 Erro crítico: ${error.message}`, 'error');
      console.log('\n❌ Setup falhou! Verifique o log acima para detalhes.');
    }
  }
}

// Executar o setup
const setup = new SupabaseTestSetup();
setup.run().catch(console.error);