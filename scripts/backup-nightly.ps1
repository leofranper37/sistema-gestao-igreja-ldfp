$ErrorActionPreference = 'Stop'

$projectPath = 'E:\sistema-gestao-igreja'
$logDir = Join-Path $projectPath 'backups'
$logFile = Join-Path $logDir ('backup-task-' + (Get-Date -Format 'yyyy-MM-dd') + '.log')

if (-not (Test-Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

Push-Location $projectPath
try {
    "[$(Get-Date -Format s)] Iniciando backup agendado" | Out-File -FilePath $logFile -Encoding utf8 -Append
    npm run backup:db | Out-File -FilePath $logFile -Encoding utf8 -Append
    if ($LASTEXITCODE -ne 0) {
        throw "npm run backup:db retornou codigo $LASTEXITCODE"
    }
    "[$(Get-Date -Format s)] Backup finalizado com sucesso" | Out-File -FilePath $logFile -Encoding utf8 -Append
}
catch {
    "[$(Get-Date -Format s)] Erro no backup: $($_.Exception.Message)" | Out-File -FilePath $logFile -Encoding utf8 -Append
    exit 1
}
finally {
    Pop-Location
}
