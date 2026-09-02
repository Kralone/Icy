[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfirmProjectName
)

$ErrorActionPreference = 'Stop'
if ($ConfirmProjectName -cne 'iceforge_dev') {
    throw 'Refus : passez exactement -ConfirmProjectName iceforge_dev.'
}

. (Join-Path $PSScriptRoot 'common.ps1')
$docker = Get-IceForgeDocker
$arguments = Get-IceForgeDevComposeArgs
$containerIds = @(& $docker @arguments ps -aq)
foreach ($containerId in $containerIds) {
    if (-not $containerId) { continue }
    $projectLabel = (& $docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' $containerId).Trim()
    if ($projectLabel -ne 'iceforge_dev') {
        throw "Refus : le conteneur $containerId n'appartient pas à iceforge_dev."
    }
}

& $docker @arguments down --volumes --remove-orphans
if ($LASTEXITCODE -ne 0) { throw 'La remise à zéro de la pile de dev a échoué.' }
Write-Host 'Pile iceforge_dev supprimée, volumes compris. Relancez start-dev.ps1 -Build -Seed.'
