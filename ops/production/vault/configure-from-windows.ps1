[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server,
    [string]$SshUser = 'iceforge-ops',
    [Parameter(Mandatory)][string]$IdentityFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
if ($SshUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Utilisateur SSH invalide.' }

$remoteCommand = 'sudo -n /root/iceforge/ops/production/vault/configure-production-secrets.sh ' +
    '--init-json /root/iceforge/.secrets/vault/prod-init.json'
$sshArguments = @(
    '-tt',
    '-o', 'StrictHostKeyChecking=yes',
    '-i', $IdentityFile,
    "$SshUser@$Server",
    $remoteCommand
)

& ssh @sshArguments
if ($LASTEXITCODE -ne 0) { throw 'Configuration Vault distante échouée.' }
Write-Host 'VAULT-PRODUCTION-CONFIG=OK' -ForegroundColor Green
