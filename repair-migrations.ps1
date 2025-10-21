# Script para reparar migrations do Supabase
Write-Host "Iniciando reparo das migrations..." -ForegroundColor Green

$migrations = @(
    "20250828211050",
    "20250901131211", 
    "20250902154222",
    "20250902154255",
    "20250904121856",
    "20250904121959",
    "20250905135438",
    "20250908203939",
    "20250908204535",
    "20250909000249",
    "20250909002123",
    "20250909003152",
    "20250909014414",
    "20250909014435",
    "20250909014505",
    "20250909014747",
    "20250909014817",
    "20250909014844",
    "20250909014907",
    "20250909015724",
    "20250909022454",
    "20250909113745",
    "20250909115232",
    "20250909130236",
    "20250909133043",
    "20250909133113",
    "20250909163456",
    "20250909202028",
    "20250911125538",
    "20250911130043",
    "20250912163501",
    "20250913133907",
    "20250913133942",
    "20250913134104",
    "20250914134233",
    "20250914134321",
    "20250916123008",
    "20250916182929",
    "20250916225154",
    "20250917130032",
    "20250917130116",
    "20250917130246",
    "20250918142442",
    "20250918142505",
    "20250918142525",
    "20250918142551",
    "20250919135308",
    "20250919135344",
    "20250921155002",
    "20250921155028",
    "20250922143012",
    "20250922145345",
    "20250925155312",
    "20250927142251",
    "20250928220051",
    "20250929172014",
    "20250930130458",
    "20251001111154",
    "20251003204636",
    "20251005015756",
    "20251008143301",
    "20251009004031",
    "20251009004253",
    "20251009010146",
    "20251009014943",
    "20251009160957",
    "20251011203344",
    "20251011214000",
    "20251015131151"
)

$totalMigrations = $migrations.Count
$currentIndex = 0

foreach ($migration in $migrations) {
    $currentIndex++
    Write-Host "[$currentIndex/$totalMigrations] Reparando migration: $migration" -ForegroundColor Yellow
    
    try {
        npx supabase migration repair --status applied $migration
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration $migration reparada com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao reparar migration $migration" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erro ao executar comando para migration $migration" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`nTodos os reparos concluídos!" -ForegroundColor Green
Write-Host "Agora tentando aplicar a migration do cron job..." -ForegroundColor Cyan

try {
    npx supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration do cron job aplicada com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao aplicar migration do cron job" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro ao executar db push" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}