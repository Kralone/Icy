[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFiles = @(
    (Join-Path $root 'docker-compose.yml'),
    (Join-Path $root 'docker-compose.validation.yml')
)
$seed = Join-Path $PSScriptRoot 'validation-fixtures.sql'

if ($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -ne 'iceforge_validation') {
    throw "Refus: COMPOSE_PROJECT_NAME doit être iceforge_validation."
}

$containerId = (& docker compose -p iceforge_validation -f $composeFiles[0] -f $composeFiles[1] ps -q db).Trim()
if (-not $containerId) {
    throw "La base jetable iceforge_validation n'est pas démarrée."
}

$projectLabel = (& docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' $containerId).Trim()
if ($projectLabel -ne 'iceforge_validation') {
    throw "Refus: le conteneur DB n'appartient pas au projet iceforge_validation."
}

$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'iceforge' }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'iceforgedb' }
Get-Content -Raw -LiteralPath $seed | & docker compose -p iceforge_validation -f $composeFiles[0] -f $composeFiles[1] exec -T db psql -v ON_ERROR_STOP=1 -U $dbUser -d $dbName
if ($LASTEXITCODE -ne 0) { throw "L'injection des fixtures a échoué." }

Write-Host "Fixtures de validation injectées dans la base jetable iceforge_validation."
