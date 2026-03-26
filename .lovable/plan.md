
Plano: destravar a aplicação de forma mais agressiva

Problema mais provável
- A lentidão não parece ser só “backend fora”. O código ainda inicia muita coisa globalmente em toda página protegida.
- Hoje o app monta verificações e consultas pesadas no layout/base, então mesmo abrindo `/vehicles` ele continua puxando processos que pertencem a dashboard, alertas e integrações.
- Além disso, o bundle inicial está grande porque `App.tsx` importa todas as páginas de forma síncrona.

Principais gargalos encontrados
1. `src/App.tsx`
- Todas as páginas são importadas no bundle inicial.
- Isso piora muito o tempo até abrir a primeira tela.

2. `src/components/layout/AppLayout.tsx`
- Toda página protegida executa:
  - `useEnsureAsaasWebhook()`
  - `<WhatsAppAlert />`
- Ou seja, até telas simples carregam lógica extra e consultas desnecessárias.

3. `src/contexts/WhatsAppContext.tsx`
- O provider continua global, envolvendo o app inteiro autenticado.
- Mesmo com delay, ele ainda mantém verificação periódica, realtime e reconexão automática para todas as páginas.

4. `src/components/layout/AppSidebar.tsx`
- Faz várias queries em sequência no mount:
  - `auth.getUser()`
  - `profiles`
  - `user_roles`
  - `companies`
  - `company_branding`
- Isso afeta qualquer rota autenticada.

5. `src/components/alerts/WhatsAppAlert.tsx`
- Ainda faz `auth.getUser()` + `profiles` + `system_alerts`.
- Fica montado em todas as páginas via layout.

6. `src/hooks/useClientRegistrations.ts`
- Fica ativo por causa do menu lateral.
- Além do realtime, ainda mantém polling a cada 30s.
- Também repete `auth.getUser()` + `profiles`.

7. `src/hooks/useFinancialData.ts`
- A tela financeira continua cara: dispara várias queries paralelas e busca conjuntos grandes.
- Não é a causa da tela `/vehicles` travar sozinha, mas ajuda a sensação geral de app pesado.

Solução proposta
1. Quebrar o bundle inicial com lazy loading
- Converter imports de páginas em `React.lazy`.
- Colocar `Suspense` por rota.
- Ganho esperado: a aplicação abre primeiro e carrega cada módulo sob demanda.

2. Tirar lógica pesada do layout global
- Remover `useEnsureAsaasWebhook()` do `AppLayout`.
- Rodar isso só em `Settings` ou numa tela de integração, onde faz sentido.
- Remover `<WhatsAppAlert />` do layout global e exibir apenas onde realmente precisa.

3. Isolar o WhatsAppProvider
- Em vez de envolver o app todo em `App.tsx`, mover o provider só para áreas que usam conexão WhatsApp.
- Ex.: Settings / Billing / telas de diagnóstico.
- Isso evita timers, realtime e edge calls em páginas como Clientes, Veículos, Contratos.

4. Enxugar o sidebar
- Parar de carregar tudo no mount.
- Buscar apenas o mínimo inicial:
  - nome do usuário
  - company_id
  - company name
- Tornar `user_roles`, branding e badge de pendências lazy/deferred.
- Idealmente usar um hook/cache único de sessão/empresa.

5. Reduzir trabalho contínuo do menu
- Em `useClientRegistrations`, remover polling de 30s e deixar só realtime.
- Se precisar fallback, usar 2-5 minutos, não 30s.
- Opcional: carregar badge só depois que a sidebar já renderizou.

6. Centralizar company/session
- Criar ou ampliar um hook/context de sessão para compartilhar:
  - usuário
  - company_id
  - nome da empresa
- Isso elimina várias chamadas repetidas de `auth.getUser()` e `profiles` em componentes diferentes.

7. Ajustar a tela financeira separadamente
- Manter otimizações já feitas, mas tratar como etapa própria:
  - paginação/limite nas transações
  - reduzir volume inicial
  - talvez carregar gráficos em segundo momento

Arquivos a alterar
- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/contexts/WhatsAppContext.tsx`
- `src/components/alerts/WhatsAppAlert.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/hooks/useClientRegistrations.ts`
- possivelmente novo hook compartilhado de sessão/empresa
- opcionalmente `src/pages/Settings.tsx` ou páginas específicas para realocar lógica do WhatsApp/Asaas

Ordem de implementação
1. Lazy loading das rotas
2. Remover `WhatsAppAlert` e `useEnsureAsaasWebhook` do layout global
3. Tirar `WhatsAppProvider` do app inteiro
4. Simplificar `AppSidebar`
5. Reduzir polling/realtime secundário
6. Revisar tela Financeiro separadamente

Resultado esperado
- A aplicação volta a abrir rápido mesmo quando backend/realtime estiverem lentos
- `/vehicles`, `/clients` e outras telas deixam de depender de integrações globais
- Menos queries simultâneas no mount
- Menos timers e listeners permanentes
- Menor chance de congelamento ao entrar no sistema

Detalhes técnicos
```text
Hoje:
App
 └─ WhatsAppProvider
    └─ BrowserRouter
       └─ AuthGuard
          └─ AppLayout
             ├─ useEnsureAsaasWebhook()
             ├─ AppSidebar
             │  ├─ auth/profile/roles/company/branding
             │  └─ pending registrations realtime + polling
             └─ WhatsAppAlert
                └─ auth/profile/system_alerts

Proposto:
App
 └─ BrowserRouter
    └─ Rotas lazy
       └─ AuthGuard
          └─ AppLayout leve
             ├─ AppSidebar enxuto
             └─ conteúdo da página

Somente onde necessário:
WhatsAppProvider
WhatsAppAlert
useEnsureAsaasWebhook
```

Risco principal
- Algumas telas podem depender implicitamente do `WhatsAppProvider` global. Na implementação, será preciso localizar onde `useWhatsAppConnection()` é usado para encapsular só essas áreas e não quebrar nada.
