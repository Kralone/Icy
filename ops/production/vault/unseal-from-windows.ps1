[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server = '82.29.170.11',
    [ValidatePattern('^[a-z_][a-z0-9_-]*$')][string]$SshUser = 'iceforge-ops',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
$sshArguments = @('-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=15', '-i', $IdentityFile, "$SshUser@$Server")
$remoteHelper = 'sudo -n python3 /root/iceforge/ops/production/vault/vault-recovery.py'

$statusJson = & ssh @sshArguments "$remoteHelper status"
if ($LASTEXITCODE -ne 0) { throw 'Lecture de l''état Vault impossible. Vérifier SSH et le script installé sur le VPS.' }
$status = ($statusJson -join "`n") | ConvertFrom-Json
if ($status.sealed -eq $false) {
    Write-Host 'Vault est déjà déverrouillé.' -ForegroundColor Green
    return
}

$secureKey = $null
$plainKey = $payload = $null
try {
    Write-Host "Vault est scellé. Seuil : $($status.t) ; progression : $($status.progress)."
    $secureKey = Read-Host 'Clé de déverrouillage Vault (saisie masquée)' -AsSecureString
    $plainKey = [Net.NetworkCredential]::new('', $secureKey).Password.Trim()
    if ([string]::IsNullOrWhiteSpace($plainKey)) { throw 'La clé ne peut pas être vide.' }
    $payload = @{ key = $plainKey } | ConvertTo-Json -Compress
    $responseJson = $payload | & ssh @sshArguments "$remoteHelper unseal"
    if ($LASTEXITCODE -ne 0) { throw 'Déverrouillage refusé. Aucun secret n''a été affiché.' }
    $response = ($responseJson -join "`n") | ConvertFrom-Json
    if ($response.sealed -eq $false) {
        Write-Host 'VAULT-UNSEAL=OK' -ForegroundColor Green
        Write-Host 'Vérifiez ensuite le backend et le bot ; leurs redémarrages automatiques peuvent prendre une minute.'
    }
    else {
        Write-Host "Vault reste scellé : $($response.progress)/$($response.t) parts. Relancez avec une autre part de clé."
    }
}
finally {
    $plainKey = $payload = $null
    if ($null -ne $secureKey) { $secureKey.Dispose() }
}
