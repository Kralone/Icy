[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$docker = Get-IceForgeDocker
$arguments = Get-IceForgeDevComposeArgs
$containerId = (& $docker @arguments ps -q db).Trim()
if (-not $containerId) {
    throw "La base locale iceforge_dev n'est pas démarrée."
}

$projectLabel = (& $docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' $containerId).Trim()
if ($projectLabel -ne 'iceforge_dev') {
    throw "Refus d'injecter les fixtures : le conteneur n'appartient pas à iceforge_dev."
}

$seed = Join-Path $script:IceForgeRoot 'ops\testing\validation-fixtures.sql'
Get-Content -Raw -LiteralPath $seed |
    & $docker @arguments exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
if ($LASTEXITCODE -ne 0) { throw "L'injection des données synthétiques a échoué." }

Write-Host 'Données synthétiques injectées dans iceforge_dev.'
