[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server = '82.29.170.11',
    [ValidatePattern('^[a-z_][a-z0-9_-]*$')][string]$SshUser = 'iceforge-ops',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519",
    # Adresse qui reçoit les alertes : fournie à l'exécution, jamais écrite dans le dépôt.
    [Parameter(Mandatory)][ValidatePattern('^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$')][string]$Recipient,
    [ValidateSet('Brevo', 'Gmail')][string]$Provider = 'Brevo',
    [string]$SmtpUsername,
    [string]$Sender = 'alertes@iceforge.fr'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
$securePassword = $null
$plainPassword = $payload = $null
try {
    Write-Host "Réception des alertes : $Recipient"
    if ($Provider -eq 'Brevo') {
        Write-Host 'Brevo : utilisez le login SMTP et une clé SMTP, pas une clé API ni votre mot de passe du compte.'
        Write-Host 'https://app.brevo.com/settings/keys/smtp'
        if ([string]::IsNullOrWhiteSpace($SmtpUsername)) { $SmtpUsername = Read-Host 'Login SMTP indiqué par Brevo' }
        Write-Host "Expéditeur : $Sender ; ce domaine et cet expéditeur doivent être validés dans Brevo."
        $securePassword = Read-Host 'Clé SMTP Brevo (saisie masquée)' -AsSecureString
    }
    else {
        $SmtpUsername = $Sender = $Recipient
        Write-Host 'Utilisez un mot de passe APPLICATION Google, jamais le mot de passe habituel.'
        Write-Host 'https://myaccount.google.com/apppasswords'
        $securePassword = Read-Host 'Mot de passe application Gmail (saisie masquée)' -AsSecureString
    }
    $plainPassword = [Net.NetworkCredential]::new('', $securePassword).Password.Trim()
    if ($Provider -eq 'Gmail') { $plainPassword = $plainPassword.Replace(' ', '') }
    if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw 'Mot de passe vide.' }
    $payload = @{ provider = $Provider.ToLowerInvariant(); recipient = $Recipient; sender = $Sender; smtp_username = $SmtpUsername.Trim(); smtp_password = $plainPassword } | ConvertTo-Json -Compress
    $payload | & ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -i $IdentityFile `
        "$SshUser@$Server" 'sudo -n python3 /root/iceforge/ops/production/monitoring/production-monitor.py configure'
    if ($LASTEXITCODE -ne 0) { throw 'Envoi de test refusé : vérifiez le login SMTP, la clé et la validation de votre expéditeur.' }
    & ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -i $IdentityFile "$SshUser@$Server" `
        'sudo -n systemctl start iceforge-monitor.service && sudo -n systemctl is-active iceforge-monitor.timer'
    if ($LASTEXITCODE -ne 0) { throw 'Configuration mail enregistrée ; vérifier le service de surveillance.' }
    Write-Host 'Alertes activées. Vérifiez le mail de test dans votre boîte Gmail.' -ForegroundColor Green
}
finally {
    $plainPassword = $payload = $null
    if ($null -ne $securePassword) { $securePassword.Dispose() }
}
