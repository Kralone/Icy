[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$docker = Get-IceForgeDocker
$arguments = (Get-IceForgeDevComposeArgs) + @('down', '--remove-orphans')
& $docker @arguments
if ($LASTEXITCODE -ne 0) { throw "L'arrêt de la pile de dev a échoué." }

Write-Host 'Pile de dev arrêtée. Les volumes persistants sont conservés.'
