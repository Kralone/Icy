[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server = '82.29.170.11',
    [ValidatePattern('^[a-z_][a-z0-9_-]*$')][string]$SshUser = 'iceforge-ops',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519",
    # Qui est notifié sur une alerte : here, everyone, none, user:<id> (un membre) ou role:<id>.
    [ValidatePattern('^(here|everyone|none|(user:|role:)?\d{15,22})$')][string]$Mention = 'here',
    # Un second salon pour le message « état en direct » (sinon le même salon que les alertes).
    [switch]$SeparateStatusChannel
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
$secrets = @()
$payload = $null
function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $script:secrets += $secure
    return [Net.NetworkCredential]::new('', $secure).Password.Trim()
}
try {
    Write-Host 'Discord : Paramètres du salon > Intégrations > Webhooks > Nouveau webhook > Copier l''URL.'
    $config = @{ mention = $Mention; webhook_url = (Read-Secret 'URL du webhook des alertes (saisie masquée)') }
    if ($SeparateStatusChannel) { $config.status_webhook_url = Read-Secret 'URL du webhook du salon « état en direct » (saisie masquée)' }
    $payload = $config | ConvertTo-Json -Compress
    # Les URL secrètes passent par stdin SSH, jamais par les arguments des processus.
    $result = $payload | & ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -i $IdentityFile `
        "$SshUser@$Server" 'sudo -n python3 /root/iceforge/ops/production/monitoring/production-monitor.py configure-discord'
    $result | Write-Host
    if ($LASTEXITCODE -ne 0) { throw 'Configuration refusée : vérifiez l''URL du webhook Discord copiée.' }
    & ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -i $IdentityFile "$SshUser@$Server" `
        'sudo -n systemctl start iceforge-monitor.service && sudo -n systemctl is-active iceforge-monitor.timer'
    if ($LASTEXITCODE -ne 0) { throw 'Configuration Discord enregistrée ; vérifier le service de surveillance.' }
    Write-Host 'Alertes Discord activées. Vérifiez le message de test et le message « état en direct » dans Discord.' -ForegroundColor Green
}
finally {
    $payload = $null
    foreach ($secure in $secrets) { $secure.Dispose() }
}
