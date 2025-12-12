-- Corrigir templates de notificação em TODAS as empresas
-- 1. template_post_due: Remover parêntese extra, ajustar R$ (agora formatCurrencyBR não inclui R$)
-- 2. template_pre_due: Já tem R$, ok
-- 3. template_on_due: Já tem R$, ok

UPDATE payment_notification_settings
SET 
  template_pre_due = 'Olá {{cliente}}, lembramos que seu pagamento de R$ {{valor}} vence em {{dias}} dia(s) ({{vencimento}}).

Pague aqui: {{link_pagamento}}',
  
  template_on_due = 'Olá {{cliente}}, seu pagamento de R$ {{valor}} vence hoje ({{vencimento}}).

Pague aqui: {{link_pagamento}}',
  
  template_post_due = 'Olá {{cliente}}, identificamos atraso de {{dias}} dia(s) no pagamento de R$ {{valor}} (vencido em {{vencimento}}).

Regularize: {{link_pagamento}}',
  
  updated_at = NOW()
WHERE template_post_due LIKE '%vencimento%)%';

-- Retornar quantidade atualizada
SELECT COUNT(*) as registros_atualizados FROM payment_notification_settings WHERE template_post_due LIKE '%vencido em {{vencimento}})%';