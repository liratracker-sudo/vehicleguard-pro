# Script para listar todos os cron jobs configurados no sistema

Write-Host "=== CRON JOBS CONFIGURADOS NO VEHICLEGUARD PRO ===" -ForegroundColor Green
Write-Host ""

# Baseado nas migrations encontradas, aqui estao os cron jobs configurados:

Write-Host "1. RELATORIOS SEMANAIS AUTOMATICOS" -ForegroundColor Cyan
Write-Host "   Nome: weekly-reports-automation"
Write-Host "   Horario: 0 6-22 * * * (a cada hora das 6h as 22h)"
Write-Host "   Funcao: weekly-reports-cron"
Write-Host "   Status: Configurado via API (nao via pg_cron)"
Write-Host ""

Write-Host "2. NOTIFICACOES DE COBRANCA - DIARIO 9H" -ForegroundColor Cyan
Write-Host "   Nome: billing-notifications-daily-9am"
Write-Host "   Horario: 0 12 * * * (todo dia as 12:00 UTC = 9:00 BRT)"
Write-Host "   Funcao: billing-notifications"
Write-Host "   Trigger: manual_9am_start com force=true"
Write-Host ""

Write-Host "3. NOTIFICACOES DE COBRANCA - VERIFICACAO PENDENTES" -ForegroundColor Cyan
Write-Host "   Nome: billing-notifications-check-pending"
Write-Host "   Horario: */5 * * * * (a cada 5 minutos)"
Write-Host "   Funcao: billing-notifications"
Write-Host "   Trigger: scheduled_check"
Write-Host ""

Write-Host "4. PROCESSAMENTO DE LEMBRETES AGENDADOS" -ForegroundColor Cyan
Write-Host "   Nome: process-scheduled-reminders"
Write-Host "   Horario: */5 * * * * (a cada 5 minutos)"
Write-Host "   Funcao: process-scheduled-reminders"
Write-Host ""

Write-Host "5. COBRANCAS VENCIDAS - COLECAO AUTOMATICA" -ForegroundColor Cyan
Write-Host "   Nome: process-overdue-payments-every-30min"
Write-Host "   Horario: */30 * * * * (a cada 30 minutos)"
Write-Host "   Funcao: ai-collection"
Write-Host "   Acao: process_overdue_clients"
Write-Host ""

Write-Host "=== RESUMO DOS HORARIOS ===" -ForegroundColor Yellow
Write-Host "- A cada 5 minutos: Notificacoes pendentes + Lembretes"
Write-Host "- A cada 30 minutos: Cobrancas vencidas"
Write-Host "- A cada hora (6h-22h): Relatorios semanais (via API externa)"
Write-Host "- Todo dia as 9h BRT: Notificacoes principais"
Write-Host ""

Write-Host "=== OBSERVACOES IMPORTANTES ===" -ForegroundColor Red
Write-Host "- Todos os horarios estao em UTC no banco"
Write-Host "- Brasil (BRT) = UTC-3"
Write-Host "- 9h BRT = 12h UTC"
Write-Host "- Relatorios semanais funcionam via API externa, nao pg_cron"
Write-Host ""

Write-Host "Script concluido!" -ForegroundColor Green