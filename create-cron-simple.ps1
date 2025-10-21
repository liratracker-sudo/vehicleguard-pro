# Script simples para criar cron job via API do Supabase

$url = "https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/weekly-reports-cron"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"
}
$body = @{
    trigger = "manual_setup"
    action = "create_cron_job"
    time = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

Write-Host "Chamando a edge function para configurar o cron job..."

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    Write-Host "Sucesso! Resposta:"
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Erro ao chamar a API:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Detalhes do erro: $responseBody"
    }
}

Write-Host "Testando se a funcao esta respondendo..."
try {
    $testBody = @{
        trigger = "test"
        time = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json
    
    $testResponse = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $testBody
    Write-Host "Funcao esta funcionando! Resposta do teste:"
    $testResponse | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Funcao pode nao estar funcionando corretamente"
    Write-Host $_.Exception.Message
}