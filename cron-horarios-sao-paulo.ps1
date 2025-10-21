# Script para mostrar todos os cron jobs com horários convertidos para São Paulo (BRT/BRST)

Write-Host "=== CRON JOBS - HORÁRIOS DE SÃO PAULO (BRASIL) ===" -ForegroundColor Green
Write-Host ""

Write-Host "🌎 INFORMAÇÕES DE FUSO HORÁRIO:" -ForegroundColor Yellow
Write-Host "   • São Paulo: UTC-3 (BRT - Horário de Brasília)"
Write-Host "   • Durante horário de verão: UTC-2 (BRST)"
Write-Host "   • Banco de dados: Todos os horários em UTC"
Write-Host ""

Write-Host "📅 CRONOGRAMA CONVERTIDO PARA SÃO PAULO:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. RELATÓRIOS SEMANAIS AUTOMÁTICOS" -ForegroundColor Green
Write-Host "   🕐 Horário no banco: 0 6-22 * * * (UTC)"
Write-Host "   🇧🇷 Horário em São Paulo: 3h às 19h (todos os dias)"
Write-Host "   📊 Função: weekly-reports-cron"
Write-Host "   ⚡ Status: Ativo via API externa"
Write-Host ""

Write-Host "2. NOTIFICAÇÕES DE COBRANÇA - EXECUÇÃO PRINCIPAL" -ForegroundColor Green
Write-Host "   🕐 Horário no banco: 0 12 * * * (UTC)"
Write-Host "   🇧🇷 Horário em São Paulo: 9h da manhã (todos os dias)"
Write-Host "   📋 Função: billing-notifications"
Write-Host "   🎯 Trigger: manual_9am_start (força execução)"
Write-Host ""

Write-Host "3. VERIFICAÇÃO DE NOTIFICAÇÕES PENDENTES" -ForegroundColor Green
Write-Host "   🕐 Horário no banco: */5 * * * * (UTC)"
Write-Host "   🇧🇷 Horário em São Paulo: A cada 5 minutos (24h por dia)"
Write-Host "   📋 Função: billing-notifications"
Write-Host "   🔍 Trigger: scheduled_check"
Write-Host ""

Write-Host "4. PROCESSAMENTO DE LEMBRETES AGENDADOS" -ForegroundColor Green
Write-Host "   🕐 Horário no banco: */5 * * * * (UTC)"
Write-Host "   🇧🇷 Horário em São Paulo: A cada 5 minutos (24h por dia)"
Write-Host "   📝 Função: process-scheduled-reminders"
Write-Host ""

Write-Host "5. COBRANÇA AUTOMÁTICA - CLIENTES INADIMPLENTES" -ForegroundColor Green
Write-Host "   🕐 Horário no banco: */30 * * * * (UTC)"
Write-Host "   🇧🇷 Horário em São Paulo: A cada 30 minutos (24h por dia)"
Write-Host "   🤖 Função: ai-collection"
Write-Host "   💰 Ação: process_overdue_clients"
Write-Host ""

Write-Host "⏰ RESUMO DOS HORÁRIOS EM SÃO PAULO:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   🔄 CONTÍNUO (24h):"
Write-Host "      • A cada 5 min: Notificações pendentes + Lembretes"
Write-Host "      • A cada 30 min: Cobrança automática de inadimplentes"
Write-Host ""
Write-Host "   🌅 HORÁRIOS ESPECÍFICOS:"
Write-Host "      • 9h da manhã: Execução principal das notificações"
Write-Host "      • 3h às 19h: Relatórios semanais (quando configurados)"
Write-Host ""

Write-Host "📋 DETALHAMENTO POR PERÍODO:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   🌙 MADRUGADA (0h-6h):"
Write-Host "      • Notificações pendentes (5 em 5 min)"
Write-Host "      • Lembretes agendados (5 em 5 min)"
Write-Host "      • Cobrança automática (30 em 30 min)"
Write-Host ""
Write-Host "   🌅 MANHÃ (6h-12h):"
Write-Host "      • Relatórios semanais (das 6h às 12h)"
Write-Host "      • 9h: EXECUÇÃO PRINCIPAL das notificações 🎯"
Write-Host "      • Processos contínuos (5 e 30 min)"
Write-Host ""
Write-Host "   ☀️ TARDE (12h-18h):"
Write-Host "      • Relatórios semanais (das 12h às 18h)"
Write-Host "      • Processos contínuos (5 e 30 min)"
Write-Host ""
Write-Host "   🌆 NOITE (18h-24h):"
Write-Host "      • Relatórios semanais (só até 19h)"
Write-Host "      • Processos contínuos (5 e 30 min)"
Write-Host ""

Write-Host "⚠️ OBSERVAÇÕES IMPORTANTES:" -ForegroundColor Red
Write-Host "   • Horário de verão: Subtrair mais 1 hora dos horários acima"
Write-Host "   • Sistema inteligente: Só executa quando necessário"
Write-Host "   • Relatórios semanais: Dependem da configuração do usuário"
Write-Host "   • Fuso automático: Sistema converte UTC para BRT automaticamente"
Write-Host ""

Write-Host "✅ Conversão concluída para o fuso horário de São Paulo!" -ForegroundColor Green