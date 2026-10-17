[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server = '82.29.170.11',
    [ValidatePattern('^[a-z_][a-z0-9_-]*$')][string]$SshUser = 'iceforge-ops',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519",
    # Adresse qui reçoit les alertes : fournie à l'exécution, jamais écrite dans le dépôt.
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')][string]$Recipient
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
$options = @('-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=15', '-i', $IdentityFile, "$SshUser@$Server")
$result = & ssh @options "sudo -n python3 /root/iceforge/ops/production/monitoring/production-monitor.py configure-local --recipient '$Recipient'"
$result | Write-Host
if ($LASTEXITCODE -ne 0) { throw 'Configuration SMTP locale impossible.' }
if (($result -join "`n") -notmatch 'MONITOR-MAIL-LOCAL=QUEUED') {
    throw 'Le TXT SPF est absent ou pas encore propagé. Ajoutez la valeur indiquée dans les DNS du domaine.'
}
& ssh @options 'sudo -n systemctl start iceforge-monitor.service && sudo -n systemctl is-active iceforge-monitor.timer'
if ($LASTEXITCODE -ne 0) { throw 'Vérifiez le service de surveillance.' }
Write-Host 'Mail de test placé dans Postfix. Vérifiez sa réception dans Gmail et la livraison dans les logs du serveur.'
