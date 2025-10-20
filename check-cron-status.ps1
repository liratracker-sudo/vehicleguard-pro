# Script para verificar se o cron job foi criado no Supabase

$url = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/weekly-reports-cron"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"
}

# Testar se a funcao esta ativa
Write-Host "Verificando se a edge function esta ativa..."
try {
    $testBody = @{
        trigger = "status_check"
        time = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $testBody
    Write-Host "Edge function esta funcionando!"
    Write-Host "Resposta: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Erro ao verificar a edge function:"
    Write-Host $_.Exception.Message
}

# Simular um trigger manual para testar o sistema
Write-Host "`nTestando trigger manual dos relatorios..."
try {
    $manualBody = @{
        trigger = "manual"
        time = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json
    
    $manualResponse = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $manualBody
    Write-Host "Trigger manual executado com sucesso!"
    Write-Host "Resposta: $($manualResponse | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Erro no trigger manual:"
    Write-Host $_.Exception.Message
}

Write-Host "`nVerificacao concluida!"
Write-Host "Se as chamadas acima funcionaram, o sistema de relatorios esta operacional."