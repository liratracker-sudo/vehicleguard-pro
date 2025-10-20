#!/usr/bin/env node

/**
 * 🌱 VehicleGuard Pro - Seed de Dados de Teste
 * 
 * Script para popular o banco de testes com dados de exemplo
 * 
 * Criado pelo Grande Mestre da VibeCoding 🔥
 */

import { createClient } from '@supabase/supabase-js';

class TestDataSeeder {
  constructor() {
    this.supabase = null;
    this.createdData = {
      companies: [],
      profiles: [],
      clients: [],
      plans: [],
      contracts: [],
      vehicles: []
    };
  }

  log(message, type = 'info') {
    const icons = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      seed: '🌱'
    };
    console.log(`${icons[type]} ${message}`);
  }

  async initialize() {
    try {
      this.log('Conectando ao Supabase...', 'seed');
      
      this.supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );

      // Teste de conexão
      const { data, error } = await this.supabase
        .from('companies')
        .select('id')
        .limit(1);

      if (error && !error.message.includes('relation "companies" does not exist')) {
        throw error;
      }

      this.log('Conexão estabelecida!', 'success');
      return true;
    } catch (error) {
      this.log(`Erro na conexão: ${error.message}`, 'error');
      return false;
    }
  }

  async seedCompanies() {
    try {
      this.log('Criando empresas de teste...', 'seed');
      
      const companies = [
        {
          name: 'VibeCoding Transportes',
          slug: 'vibecoding-transportes',
          email: 'contato@vibecoding.com.br',
          phone: '(11) 99999-9999',
          address: 'Rua dos Desenvolvedores, 123 - São Paulo/SP',
          primary_color: '#3b82f6',
          secondary_color: '#f8fafc',
          settings: {
            whatsapp_enabled: true,
            notifications_enabled: true,
            billing_day: 5
          }
        },
        {
          name: 'Logística Master',
          slug: 'logistica-master',
          email: 'admin@logisticamaster.com.br',
          phone: '(21) 88888-8888',
          address: 'Av. Principal, 456 - Rio de Janeiro/RJ',
          primary_color: '#10b981',
          secondary_color: '#f0fdf4',
          settings: {
            whatsapp_enabled: false,
            notifications_enabled: true,
            billing_day: 10
          }
        }
      ];

      const { data, error } = await this.supabase
        .from('companies')
        .insert(companies)
        .select();

      if (error) throw error;

      this.createdData.companies = data;
      this.log(`${data.length} empresas criadas!`, 'success');
      
      return data;
    } catch (error) {
      this.log(`Erro ao criar empresas: ${error.message}`, 'error');
      return [];
    }
  }

  async seedPlans() {
    try {
      this.log('Criando planos de teste...', 'seed');
      
      const plans = [];
      
      for (const company of this.createdData.companies) {
        const companyPlans = [
          {
            company_id: company.id,
            name: 'Básico',
            description: 'Plano básico para pequenas frotas',
            price: 99.90,
            billing_cycle: 'monthly',
            features: [
              'Até 5 veículos',
              'Rastreamento básico',
              'Relatórios mensais',
              'Suporte por email'
            ]
          },
          {
            company_id: company.id,
            name: 'Profissional',
            description: 'Plano completo para frotas médias',
            price: 199.90,
            billing_cycle: 'monthly',
            features: [
              'Até 20 veículos',
              'Rastreamento avançado',
              'Relatórios em tempo real',
              'Alertas personalizados',
              'Suporte prioritário'
            ]
          },
          {
            company_id: company.id,
            name: 'Enterprise',
            description: 'Solução completa para grandes frotas',
            price: 499.90,
            billing_cycle: 'monthly',
            features: [
              'Veículos ilimitados',
              'Todas as funcionalidades',
              'API personalizada',
              'Suporte 24/7',
              'Treinamento incluído'
            ]
          }
        ];
        
        plans.push(...companyPlans);
      }

      const { data, error } = await this.supabase
        .from('plans')
        .insert(plans)
        .select();

      if (error) throw error;

      this.createdData.plans = data;
      this.log(`${data.length} planos criados!`, 'success');
      
      return data;
    } catch (error) {
      this.log(`Erro ao criar planos: ${error.message}`, 'error');
      return [];
    }
  }

  async seedClients() {
    try {
      this.log('Criando clientes de teste...', 'seed');
      
      const clients = [];
      
      for (const company of this.createdData.companies) {
        const companyClients = [
          {
            company_id: company.id,
            name: 'João Silva Transportes',
            email: 'joao@silvatransportes.com.br',
            phone: '(11) 91234-5678',
            document: '12.345.678/0001-90',
            address: 'Rua das Flores, 789 - São Paulo/SP',
            status: 'active'
          },
          {
            company_id: company.id,
            name: 'Maria Santos Logística',
            email: 'maria@santoslogistica.com.br',
            phone: '(11) 98765-4321',
            document: '98.765.432/0001-10',
            address: 'Av. dos Caminhoneiros, 321 - São Paulo/SP',
            status: 'active'
          },
          {
            company_id: company.id,
            name: 'Pedro Costa Fretes',
            email: 'pedro@costafretes.com.br',
            phone: '(11) 95555-5555',
            document: '11.222.333/0001-44',
            address: 'Rua do Comércio, 654 - São Paulo/SP',
            status: 'active'
          }
        ];
        
        clients.push(...companyClients);
      }

      const { data, error } = await this.supabase
        .from('clients')
        .insert(clients)
        .select();

      if (error) throw error;

      this.createdData.clients = data;
      this.log(`${data.length} clientes criados!`, 'success');
      
      return data;
    } catch (error) {
      this.log(`Erro ao criar clientes: ${error.message}`, 'error');
      return [];
    }
  }

  async seedContracts() {
    try {
      this.log('Criando contratos de teste...', 'seed');
      
      const contracts = [];
      
      for (const company of this.createdData.companies) {
        const companyClients = this.createdData.clients.filter(c => c.company_id === company.id);
        const companyPlans = this.createdData.plans.filter(p => p.company_id === company.id);
        
        for (let i = 0; i < companyClients.length; i++) {
          const client = companyClients[i];
          const plan = companyPlans[i % companyPlans.length]; // Distribui os planos
          
          contracts.push({
            company_id: company.id,
            client_id: client.id,
            plan_id: plan.id,
            start_date: new Date().toISOString().split('T')[0],
            monthly_value: plan.price,
            status: 'active'
          });
        }
      }

      const { data, error } = await this.supabase
        .from('contracts')
        .insert(contracts)
        .select();

      if (error) throw error;

      this.createdData.contracts = data;
      this.log(`${data.length} contratos criados!`, 'success');
      
      return data;
    } catch (error) {
      this.log(`Erro ao criar contratos: ${error.message}`, 'error');
      return [];
    }
  }

  async seedVehicles() {
    try {
      this.log('Criando veículos de teste...', 'seed');
      
      const vehicles = [];
      const vehicleTypes = ['Caminhão', 'Van', 'Carreta', 'Bitrem'];
      const brands = ['Volvo', 'Scania', 'Mercedes', 'Iveco', 'Ford'];
      
      for (const contract of this.createdData.contracts) {
        const vehicleCount = Math.floor(Math.random() * 3) + 1; // 1 a 3 veículos por contrato
        
        for (let i = 0; i < vehicleCount; i++) {
          const brand = brands[Math.floor(Math.random() * brands.length)];
          const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
          const plate = `ABC${Math.floor(Math.random() * 9000) + 1000}`;
          
          vehicles.push({
            company_id: contract.company_id,
            client_id: contract.client_id,
            contract_id: contract.id,
            plate: plate,
            brand: brand,
            model: `${brand} ${type}`,
            year: 2020 + Math.floor(Math.random() * 4),
            color: ['Branco', 'Azul', 'Vermelho', 'Prata'][Math.floor(Math.random() * 4)],
            chassis: `9BW${Math.random().toString(36).substr(2, 14).toUpperCase()}`,
            status: 'active',
            tracker_id: `TRK${Math.floor(Math.random() * 90000) + 10000}`,
            settings: {
              speed_limit: 80,
              alerts_enabled: true,
              maintenance_km: 10000
            }
          });
        }
      }

      const { data, error } = await this.supabase
        .from('vehicles')
        .insert(vehicles)
        .select();

      if (error) throw error;

      this.createdData.vehicles = data;
      this.log(`${data.length} veículos criados!`, 'success');
      
      return data;
    } catch (error) {
      this.log(`Erro ao criar veículos: ${error.message}`, 'error');
      return [];
    }
  }

  async generateSummary() {
    try {
      this.log('Gerando resumo dos dados criados...', 'seed');
      
      const summary = `
# 🌱 Resumo dos Dados de Teste Criados

## 📊 Estatísticas

- **Empresas**: ${this.createdData.companies.length}
- **Planos**: ${this.createdData.plans.length}
- **Clientes**: ${this.createdData.clients.length}
- **Contratos**: ${this.createdData.contracts.length}
- **Veículos**: ${this.createdData.vehicles.length}

## 🏢 Empresas Criadas

${this.createdData.companies.map(company => `
### ${company.name}
- **Slug**: ${company.slug}
- **Email**: ${company.email}
- **Telefone**: ${company.phone}
- **Endereço**: ${company.address}
`).join('')}

## 📋 Planos por Empresa

${this.createdData.companies.map(company => {
  const companyPlans = this.createdData.plans.filter(p => p.company_id === company.id);
  return `
### ${company.name}
${companyPlans.map(plan => `- **${plan.name}**: R$ ${plan.price} (${plan.billing_cycle})`).join('\n')}
`;
}).join('')}

## 👥 Clientes e Contratos

${this.createdData.companies.map(company => {
  const companyClients = this.createdData.clients.filter(c => c.company_id === company.id);
  const companyContracts = this.createdData.contracts.filter(c => c.company_id === company.id);
  
  return `
### ${company.name}
${companyClients.map(client => {
    const contract = companyContracts.find(c => c.client_id === client.id);
    const plan = this.createdData.plans.find(p => p.id === contract?.plan_id);
    return `- **${client.name}** (${client.phone}) - Plano: ${plan?.name || 'N/A'}`;
  }).join('\n')}
`;
}).join('')}

## 🚗 Veículos por Cliente

${this.createdData.contracts.map(contract => {
  const client = this.createdData.clients.find(c => c.id === contract.client_id);
  const contractVehicles = this.createdData.vehicles.filter(v => v.contract_id === contract.id);
  
  return `
### ${client?.name || 'Cliente N/A'}
${contractVehicles.map(vehicle => `- **${vehicle.plate}** - ${vehicle.brand} ${vehicle.model} (${vehicle.year})`).join('\n')}
`;
}).join('')}

## 🔧 Próximos Passos

1. **Testar Login**: Crie um usuário admin para acessar o sistema
2. **Verificar Dados**: Acesse o dashboard e confirme se os dados aparecem
3. **Testar Funcionalidades**: Navegue pelas diferentes seções
4. **Criar Alertas**: Teste o sistema de alertas com os veículos
5. **Gerar Relatórios**: Verifique se os relatórios funcionam

## 🆘 Comandos Úteis

\`\`\`bash
# Validar setup completo
npm run setup:validate

# Resetar dados (cuidado!)
npm run setup:reset

# Verificar ambiente atual
npm run setup:check
\`\`\`

---
Dados gerados pelo Seeder VibeCoding 🌱
Data: ${new Date().toLocaleString('pt-BR')}
`;

      const fs = await import('fs');
      fs.writeFileSync('seed-summary.md', summary);
      this.log('Resumo salvo em seed-summary.md', 'success');
      
    } catch (error) {
      this.log(`Erro ao gerar resumo: ${error.message}`, 'error');
    }
  }

  async run() {
    console.log(`
🌱 VehicleGuard Pro - Seed de Dados de Teste
============================================

Vamos popular seu banco com dados realistas! 🔥
`);

    try {
      // Inicializar conexão
      const connected = await this.initialize();
      if (!connected) {
        this.log('Não foi possível conectar. Verifique as configurações!', 'error');
        return;
      }

      // Executar seeds em ordem
      await this.seedCompanies();
      await this.seedPlans();
      await this.seedClients();
      await this.seedContracts();
      await this.seedVehicles();

      // Gerar resumo
      await this.generateSummary();

      console.log(`
🎉 SEED CONCLUÍDO COM SUCESSO!

📊 Dados criados:
- ${this.createdData.companies.length} empresas
- ${this.createdData.plans.length} planos
- ${this.createdData.clients.length} clientes
- ${this.createdData.contracts.length} contratos
- ${this.createdData.vehicles.length} veículos

📁 Arquivos gerados:
- seed-summary.md (resumo completo)

🚀 Próximos passos:
1. Execute: npm run setup:validate
2. Acesse a aplicação e teste os dados
3. Crie um usuário admin se necessário

Tamo junto, master! Agora é só testar! 🔥
`);

    } catch (error) {
      this.log(`Erro crítico no seed: ${error.message}`, 'error');
    }
  }
}

// Executar seed
const seeder = new TestDataSeeder();
seeder.run().catch(console.error);