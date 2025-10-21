# Script para mostrar todos os cron jobs com horarios convertidos para Sao Paulo (BRT/BRST)

Write-Host "=== CRON JOBS - HORARIOS DE SAO PAULO (BRASIL) ===" -ForegroundColor Green
Write-Host ""

Write-Host "INFORMACOES DE FUSO HORARIO:" -ForegroundColor Yellow
Write-Host "   • Sao Paulo: UTC-3 (BRT - Horario de Brasilia)"
Write-Host "   • Durante horario de verao: UTC-2 (BRST)"
Write-Host "   • Banco de dados: Todos os horarios em UTC"
Write-Host ""

Write-Host "CRONOGRAMA CONVERTIDO PARA SAO PAULO:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. RELATORIOS SEMANAIS AUTOMATICOS" -ForegroundColor Green
Write-Host "   Horario no banco: 0 6-22 * * * (UTC)"
Write-Host "   Horario em Sao Paulo: 3h as 19h (todos os dias)"
Write-Host "   Funcao: weekly-reports-cron"
Write-Host "   Status: Ativo via API externa"
Write-Host ""

Write-Host "2. NOTIFICACOES DE COBRANCA - EXECUCAO PRINCIPAL" -ForegroundColor Green
Write-Host "   Horario no banco: 0 12 * * * (UTC)"
Write-Host "   Horario em Sao Paulo: 9h da manha (todos os dias)"
Write-Host "   Funcao: billing-notifications"
Write-Host "   Trigger: manual_9am_start (forca execucao)"
Write-Host ""

Write-Host "3. VERIFICACAO DE NOTIFICACOES PENDENTES" -ForegroundColor Green
Write-Host "   Horario no banco: */5 * * * * (UTC)"
Write-Host "   Horario em Sao Paulo: A cada 5 minutos (24h por dia)"
Write-Host "   Funcao: billing-notifications"
Write-Host "   Trigger: scheduled_check"
Write-Host ""

Write-Host "4. PROCESSAMENTO DE LEMBRETES AGENDADOS" -ForegroundColor Green
Write-Host "   Horario no banco: */5 * * * * (UTC)"
Write-Host "   Horario em Sao Paulo: A cada 5 minutos (24h por dia)"
Write-Host "   Funcao: process-scheduled-reminders"
Write-Host ""

Write-Host "5. COBRANCA AUTOMATICA - CLIENTES INADIMPLENTES" -ForegroundColor Green
Write-Host "   Horario no banco: */30 * * * * (UTC)"
Write-Host "   Horario em Sao Paulo: A cada 30 minutos (24h por dia)"
Write-Host "   Funcao: ai-collection"
Write-Host "   Acao: process_overdue_clients"
Write-Host ""

Write-Host "RESUMO DOS HORARIOS EM SAO PAULO:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   CONTINUO (24h):"
Write-Host "      • A cada 5 min: Notificacoes pendentes + Lembretes"
Write-Host "      • A cada 30 min: Cobranca automatica de inadimplentes"
Write-Host ""
Write-Host "   HORARIOS ESPECIFICOS:"
Write-Host "      • 9h da manha: Execucao principal das notificacoes"
Write-Host "      • 3h as 19h: Relatorios semanais (quando configurados)"
Write-Host ""

Write-Host "DETALHAMENTO POR PERIODO:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   MADRUGADA (0h-6h):"
Write-Host "      • Notificacoes pendentes (5 em 5 min)"
Write-Host "      • Lembretes agendados (5 em 5 min)"
Write-Host "      • Cobranca automatica (30 em 30 min)"
Write-Host ""
Write-Host "   MANHA (6h-12h):"
Write-Host "      • Relatorios semanais (das 6h as 12h)"
Write-Host "      • 9h: EXECUCAO PRINCIPAL das notificacoes"
Write-Host "      • Processos continuos (5 e 30 min)"
Write-Host ""
Write-Host "   TARDE (12h-18h):"
Write-Host "      • Relatorios semanais (das 12h as 18h)"
Write-Host "      • Processos continuos (5 e 30 min)"
Write-Host ""
Write-Host "   NOITE (18h-24h):"
Write-Host "      • Relatorios semanais (so ate 19h)"
Write-Host "      • Processos continuos (5 e 30 min)"
Write-Host ""

Write-Host "OBSERVACOES IMPORTANTES:" -ForegroundColor Red
Write-Host "   • Horario de verao: Subtrair mais 1 hora dos horarios acima"
Write-Host "   • Sistema inteligente: So executa quando necessario"
Write-Host "   • Relatorios semanais: Dependem da configuracao do usuario"
Write-Host "   • Fuso automatico: Sistema converte UTC para BRT automaticamente"
Write-Host ""

Write-Host "Conversao concluida para o fuso horario de Sao Paulo!" -ForegroundColor Green