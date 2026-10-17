# Dump the local Docker MySQL (podosphere-mysql, host port 3307) to ./backups/.
# Usage: pwsh -File scripts/backup-mysql.ps1
# Env overrides: MYSQL_CONTAINER, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, BACKUP_DIR

$ErrorActionPreference = 'Stop'

$Container = if ($env:MYSQL_CONTAINER) { $env:MYSQL_CONTAINER } else { 'podosphere-mysql' }
$Database = if ($env:MYSQL_DATABASE) { $env:MYSQL_DATABASE } else { 'podo_social' }
$User = if ($env:MYSQL_USER) { $env:MYSQL_USER } else { 'podo' }
$Password = if ($env:MYSQL_PASSWORD) { $env:MYSQL_PASSWORD } else { 'podo' }
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else {
  Join-Path (Split-Path $PSScriptRoot -Parent) 'backups'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error 'docker is required (mysqldump runs inside the MySQL container).'
}

$running = docker inspect -f '{{.State.Running}}' $Container 2>$null
if ($running -ne 'true') {
  Write-Error "Container '$Container' is not running. Start with: docker compose up -d mysql"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $BackupDir "${Database}_${stamp}.sql"
$remoteTmp = "/tmp/${Database}_${stamp}.sql"

Write-Host "Dumping $Database from $Container -> $outFile"

# Write inside the container, then docker cp — avoids PowerShell UTF-8 BOM on the dump.
docker exec $Container sh -c "mysqldump -u$User -p$Password --single-transaction --routines --triggers --databases $Database > $remoteTmp"
docker cp "${Container}:${remoteTmp}" $outFile
docker exec $Container rm -f $remoteTmp | Out-Null

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -lt 64) {
  Write-Error "Backup looks empty or missing: $outFile"
}

Write-Host "OK: $outFile ($((Get-Item $outFile).Length) bytes)"
