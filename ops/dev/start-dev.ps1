[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$Seed,
    [switch]$Bot
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$docker = Get-IceForgeDocker
$arguments = Get-IceForgeDevComposeArgs
if ($Bot) {
    $arguments += @('--profile', 'dev-discord')
}
$arguments += @('up', '-d', '--wait')
if ($Build) {
    $arguments += '--build'
}

& $docker @arguments
if ($LASTEXITCODE -ne 0) { throw 'Le démarrage de la pile de dev a échoué.' }

if ($Seed) {
    & (Join-Path $PSScriptRoot 'seed-dev.ps1')
}

Write-Host 'IceForge dev est prêt sur http://127.0.0.1:18088.'
