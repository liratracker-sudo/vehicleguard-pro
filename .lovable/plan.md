
# Plano: Rastreamento de Origem dos Cadastros

## Problema

Atualmente, quando os clientes se cadastram pelo link público `/cadastro/{empresa}`, não há como identificar:
- Se a indicação veio de um **vendedor/representante**
- Se foi **indicação de um cliente existente**
- Se veio de uma **campanha de marketing** específica
- Qual **canal** gerou o cadastro (QR Code, link direto, redes sociais)

## Solução Proposta

Implementar um sistema de rastreamento usando **parâmetros UTM** no link de cadastro + **tabela de vendedores** + **indicação de clientes**.

## Arquitetura

```text
Link de Cadastro com Parâmetros:
┌────────────────────────────────────────────────────────────────────────┐
│ https://app.liratracker.com.br/cadastro/minha-empresa                  │
│                     ?ref=vendedor_joao                                 │
│                     &utm_source=instagram                              │
│                     &utm_campaign=promo_janeiro                        │
│                     &indicado_por=ABC1234 (placa do cliente indicador) │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Formulário de Cadastro                              │
│   • Captura automaticamente os parâmetros da URL                       │
│   • Campo opcional: "Como conheceu nossa empresa?"                     │
│   • Campo opcional: "Quem te indicou?" (busca por placa/nome)          │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Tabela client_registrations                            │
│   Novos campos:                                                        │
│   • referral_source: 'vendedor' | 'cliente' | 'campanha' | 'organico'  │
│   • referral_code: código do vendedor ou placa do cliente              │
│   • referral_name: nome do indicador (cache para exibição)             │
│   • utm_source, utm_medium, utm_campaign                               │
│   • how_did_you_hear: resposta do campo de origem                      │
└────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Banco de Dados

### 1. Nova Tabela: `sellers` (Vendedores/Representantes)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Identificador único |
| company_id | uuid | Empresa do vendedor |
| name | text | Nome do vendedor |
| code | text | Código único (ex: "JOAO01") |
| phone | text | Telefone (opcional) |
| email | text | Email (opcional) |
| commission_rate | numeric | % de comissão (opcional) |
| is_active | boolean | Se está ativo |
| registrations_count | integer | Contador de cadastros |
| created_at, updated_at | timestamp | Datas |

### 2. Novos Campos na Tabela `client_registrations`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| referral_source | text | 'seller', 'client', 'campaign', 'organic', 'direct' |
| referral_code | text | Código do vendedor OU placa/documento do cliente indicador |
| referral_name | text | Nome do indicador (para exibição rápida) |
| seller_id | uuid | FK para sellers (se for vendedor) |
| referred_by_client_id | uuid | FK para clients (se for indicação de cliente) |
| utm_source | text | Fonte (instagram, google, facebook) |
| utm_medium | text | Meio (cpc, organic, referral) |
| utm_campaign | text | Nome da campanha |
| how_did_you_hear | text | Resposta do campo "como conheceu" |

## Fluxo de Uso

### Para Vendedores:
1. Admin cadastra vendedores no sistema com códigos únicos
2. Cada vendedor recebe seu link personalizado:
   - `https://app.liratracker.com.br/cadastro/minha-empresa?ref=JOAO01`
3. Cadastros vindos deste link são automaticamente vinculados ao vendedor

### Para Indicação de Clientes:
1. Cliente existente compartilha link com sua placa:
   - `https://app.liratracker.com.br/cadastro/minha-empresa?indicado_por=ABC1234`
2. OU no formulário, novo cliente seleciona "Fui indicado por um cliente" e busca por placa/nome
3. Sistema registra a indicação e pode gerar benefícios/comissões

### Para Campanhas:
1. Marketing cria links com UTM:
   - `?utm_source=instagram&utm_campaign=promo_carnaval`
2. Sistema agrupa cadastros por campanha nos relatórios

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Migração SQL** | Criar tabela sellers + novos campos em client_registrations |
| `src/pages/PublicClientRegistration.tsx` | Capturar parâmetros URL + campos de indicação |
| `supabase/functions/process-client-registration/index.ts` | Processar dados de origem |
| `src/pages/ClientRegistrations.tsx` | Exibir origem do cadastro |
| **Criar** `src/pages/Sellers.tsx` | Gestão de vendedores |
| `src/components/layout/AppSidebar.tsx` | Adicionar menu de vendedores |
| `src/pages/WhiteLabel.tsx` | Gerador de links com parâmetros |

## Interface do Formulário de Cadastro

Adicionar seção opcional no formulário:

```text
┌────────────────────────────────────────────────┐
│  Como você conheceu nossa empresa?             │
│  ┌──────────────────────────────────────────┐  │
│  │ ▼ Selecione uma opção                    │  │
│  ├──────────────────────────────────────────┤  │
│  │ • Indicação de amigo/cliente             │  │
│  │ • Vendedor/Representante                 │  │
│  │ • Instagram                              │  │
│  │ • Facebook                               │  │
│  │ • Google                                 │  │
│  │ • QR Code                                │  │
│  │ • Outro                                  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Se foi indicação, quem te indicou?            │
│  [___________________________________]         │
│   (Nome, placa ou código do vendedor)          │
└────────────────────────────────────────────────┘
```

## Interface de Visualização (ClientRegistrations)

Adicionar badge de origem em cada cadastro:

```text
┌─────────────────────────────────────────────────────────────┐
│  JOÃO SILVA                                    [Pendente]   │
│  🚗 2 veículo(s) - ABC1234, DEF5678                         │
│                                                             │
│  📞 Telefone: (11) 99999-9999                               │
│  📄 CPF: 123.456.789-00                                     │
│  📅 Data: 15 de janeiro de 2025                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 👤 Origem: Vendedor JOÃO VENDEDOR (código: JOAO01)  │    │
│  │ 📱 Fonte: Instagram • Campanha: Promo Janeiro       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Ver Detalhes]  [Aprovar]  [Rejeitar]                      │
└─────────────────────────────────────────────────────────────┘
```

## Página de Gestão de Vendedores

Nova página `/sellers` com:
- Lista de vendedores cadastrados
- Código único para cada vendedor
- Link personalizado com QR Code
- Contador de cadastros por vendedor
- Relatório de performance

## Gerador de Links (WhiteLabel)

Expandir a seção de links para incluir:
- Seleção de vendedor para gerar link
- Campos UTM personalizados
- Preview do link completo
- QR Code específico para cada link

## Relatórios

Adicionar relatório de origem de cadastros:
- Total por origem (vendedor/cliente/campanha/orgânico)
- Ranking de vendedores por cadastros
- Clientes que mais indicam
- Campanhas mais efetivas

## Benefícios

1. **Comissões de Vendedores**: Identificar quem trouxe cada cliente
2. **Programa de Indicação**: Premiar clientes que indicam
3. **ROI de Marketing**: Medir efetividade de campanhas
4. **Gestão de Equipe**: Acompanhar performance de vendedores
5. **Tomada de Decisão**: Saber onde investir em captação

## Etapas de Implementação

1. Migração SQL: criar tabela sellers e novos campos
2. Atualizar formulário público com captura de parâmetros
3. Atualizar edge function para processar origem
4. Exibir origem na listagem de cadastros
5. Criar página de gestão de vendedores
6. Expandir gerador de links no WhiteLabel
7. Adicionar relatórios de origem
