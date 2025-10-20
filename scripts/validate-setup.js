#!/usr/bin/env node

/**
 * 🔍 VehicleGuard Pro - Validador de Setup
 * 
 * Script para validar se o ambiente de testes foi configurado corretamente
 * 
 * Criado pelo Grande Mestre da VibeCoding 🔥
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

class SetupValidator {
  constructor() {
    this.results = {
      connection: false,
      tables: [],
      policies: [],
      functions: [],
      environment: false,
      overall: false
    };
    
    this.requiredTables = [
      'companies',
      'profiles', 
      'clients',
      'plans',
      'contracts',
      'invoices',
      'vehicles',
      'alerts'
    ];
  }

  log(message, type = 'info') {
    const icons = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };
    console.log(`${icons[type]} ${message}`);
  }

  async validateEnvironment() {
    try {
      this.log('Validando variáveis de ambiente...');
      
      const requiredVars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_PROJECT_ID', 
        'VITE_SUPABASE_PUBLISHABLE_KEY'
      ];

      const missing = [];
      
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          missing.push(varName);
        }
      }

      if (missing.length > 0) {
        this.log(`Variáveis faltando: ${missing.join(', ')}`, 'error');
        return false;
      }

      // Verificar se não são as credenciais de exemplo
      if (process.env.VITE_SUPABASE_PROJECT_ID === 'SEU_NOVO_PROJECT_ID_AQUI') {
        this.log('Credenciais ainda não foram configuradas!', 'error');
        return false;
      }

      this.log('Variáveis de ambiente OK!', 'success');
      this.results.environment = true;
      return true;
    } catch (error) {
      this.log(`Erro na validação do ambiente: ${error.message}`, 'error');
      return false;
    }
  }

  async validateConnection() {
    try {
      this.log('Testando conexão com Supabase...');
      
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );

      // Teste simples de conexão
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error) {
        throw error;
      }

      this.log('Conexão estabelecida com sucesso!', 'success');
      this.results.connection = true;
      return supabase;
    } catch (error) {
      this.log(`Erro de conexão: ${error.message}`, 'error');
      return null;
    }
  }

  async validateTables(supabase) {
    try {
      this.log('Verificando tabelas criadas...');
      
      const { data: tables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (error) {
        throw error;
      }

      const existingTables = tables.map(t => t.table_name);
      const missingTables = this.requiredTables.filter(
        table => !existingTables.includes(table)
      );

      if (missingTables.length > 0) {
        this.log(`Tabelas faltando: ${missingTables.join(', ')}`, 'warning');
      } else {
        this.log('Todas as tabelas principais encontradas!', 'success');
      }

      this.results.tables = existingTables;
      this.log(`Total de tabelas: ${existingTables.length}`);
      
      return missingTables.length === 0;
    } catch (error) {
      this.log(`Erro ao verificar tabelas: ${error.message}`, 'error');
      return false;
    }
  }

  async validatePolicies(supabase) {
    try {
      this.log('Verificando políticas RLS...');
      
      const { data: policies, error } = await supabase
        .from('pg_policies')
        .select('tablename, policyname')
        .in('tablename', this.requiredTables);

      if (error) {
        this.log('Não foi possível verificar políticas (normal em alguns casos)', 'warning');
        return true; // Não é crítico
      }

      this.results.policies = policies || [];
      this.log(`Políticas RLS encontradas: ${policies?.length || 0}`, 'success');
      
      return true;
    } catch (error) {
      this.log(`Aviso ao verificar políticas: ${error.message}`, 'warning');
      return true; // Não é crítico
    }
  }

  async validateFunctions(supabase) {
    try {
      this.log('Verificando funções personalizadas...');
      
      const { data: functions, error } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public')
        .eq('routine_type', 'FUNCTION');

      if (error) {
        this.log('Não foi possível verificar funções', 'warning');
        return true;
      }

      this.results.functions = functions || [];
      this.log(`Funções encontradas: ${functions?.length || 0}`, 'success');
      
      return true;
    } catch (error) {
      this.log(`Aviso ao verificar funções: ${error.message}`, 'warning');
      return true;
    }
  }

  async testBasicOperations(supabase) {
    try {
      this.log('Testando operações básicas...');
      
      // Teste de leitura na tabela companies
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .limit(5);

      if (companiesError) {
        throw companiesError;
      }

      this.log(`Teste de leitura OK (${companies?.length || 0} empresas encontradas)`, 'success');
      
      // Teste de autenticação (se possível)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        this.log('Usuário não autenticado (normal para testes)', 'warning');
      } else {
        this.log(`Usuário autenticado: ${user?.email || 'N/A'}`, 'success');
      }

      return true;
    } catch (error) {
      this.log(`Erro nos testes básicos: ${error.message}`, 'error');
      return false;
    }
  }

  generateReport() {
    const report = `
# 📊 Relatório de Validação - VehicleGuard Pro

## 🎯 Resumo Geral
- **Status**: ${this.results.overall ? '✅ APROVADO' : '❌ REPROVADO'}
- **Data**: ${new Date().toLocaleString('pt-BR')}
- **Ambiente**: ${process.env.VITE_SUPABASE_URL || 'Não configurado'}

## 📋 Detalhes da Validação

### 🔧 Ambiente
- **Status**: ${this.results.environment ? '✅ OK' : '❌ ERRO'}
- **URL**: ${process.env.VITE_SUPABASE_URL || 'Não definida'}
- **Project ID**: ${process.env.VITE_SUPABASE_PROJECT_ID || 'Não definido'}

### 🔌 Conexão
- **Status**: ${this.results.connection ? '✅ OK' : '❌ ERRO'}

### 📊 Tabelas (${this.results.tables.length} encontradas)
${this.results.tables.map(table => `- ${table}`).join('\n')}

### 🔒 Políticas RLS (${this.results.policies.length} encontradas)
${this.results.policies.map(policy => `- ${policy.tablename}.${policy.policyname}`).join('\n')}

### ⚙️ Funções (${this.results.functions.length} encontradas)
${this.results.functions.map(func => `- ${func.routine_name}`).join('\n')}

## 🚀 Próximos Passos

${this.results.overall ? 
  '✅ Ambiente validado com sucesso! Você pode começar a usar o sistema de testes.' :
  '❌ Problemas encontrados. Verifique os erros acima e execute novamente o setup.'
}

---
Gerado pelo Validador VibeCoding 🔥
`;

    fs.writeFileSync('validation-report.md', report);
    this.log('Relatório salvo em validation-report.md', 'success');
  }

  async run() {
    console.log(`
🔍 VehicleGuard Pro - Validação de Setup
========================================

Verificando se tudo está funcionando perfeitamente! 🔥
`);

    try {
      // Validar ambiente
      const envOk = await this.validateEnvironment();
      if (!envOk) {
        this.log('Configure o ambiente antes de continuar!', 'error');
        return;
      }

      // Validar conexão
      const supabase = await this.validateConnection();
      if (!supabase) {
        this.log('Não foi possível conectar ao Supabase!', 'error');
        return;
      }

      // Validar estrutura
      const tablesOk = await this.validateTables(supabase);
      const policiesOk = await this.validatePolicies(supabase);
      const functionsOk = await this.validateFunctions(supabase);
      const operationsOk = await this.testBasicOperations(supabase);

      // Resultado final
      this.results.overall = envOk && this.results.connection && tablesOk && operationsOk;

      // Gerar relatório
      this.generateReport();

      // Resultado final
      console.log(`
${this.results.overall ? '🎉' : '💥'} VALIDAÇÃO ${this.results.overall ? 'CONCLUÍDA' : 'FALHOU'}!

📊 Resumo:
- Ambiente: ${this.results.environment ? '✅' : '❌'}
- Conexão: ${this.results.connection ? '✅' : '❌'}
- Tabelas: ${tablesOk ? '✅' : '❌'} (${this.results.tables.length} encontradas)
- Operações: ${operationsOk ? '✅' : '❌'}

${this.results.overall ? 
  '🚀 Tudo certo! Seu ambiente de testes está pronto para uso!' :
  '🔧 Alguns problemas foram encontrados. Verifique o relatório para detalhes.'
}
`);

    } catch (error) {
      this.log(`Erro crítico na validação: ${error.message}`, 'error');
    }
  }
}

// Executar validação
const validator = new SetupValidator();
validator.run().catch(console.error);