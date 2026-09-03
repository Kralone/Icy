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

Write-Host 'Laissez une valeur vide pour conserver la valeur Vault actuelle.'
$secureJwt = Read-Host 'Secret JWT (masque)' -AsSecureString
$secureBotKey = Read-Host 'Cle partagee backend/bot (masquee)' -AsSecureString
$secureDiscord = Read-Host 'Token du bot Discord de production (masque)' -AsSecureString
$secureOpenAi = Read-Host 'Cle API OpenAI, optionnelle (masquee)' -AsSecureString
$secureUex = Read-Host 'Cle API UEX, optionnelle (masquee)' -AsSecureString
$secureVapidPublic = Read-Host 'Cle publique VAPID, optionnelle (masquee)' -AsSecureString
$secureVapidPrivate = Read-Host 'Cle privee VAPID, optionnelle (masquee)' -AsSecureString

$plainJwt = [Net.NetworkCredential]::new('', $secureJwt).Password
$plainBotKey = [Net.NetworkCredential]::new('', $secureBotKey).Password
$plainDiscord = [Net.NetworkCredential]::new('', $secureDiscord).Password
$plainOpenAi = [Net.NetworkCredential]::new('', $secureOpenAi).Password
$plainUex = [Net.NetworkCredential]::new('', $secureUex).Password
$plainVapidPublic = [Net.NetworkCredential]::new('', $secureVapidPublic).Password
$plainVapidPrivate = [Net.NetworkCredential]::new('', $secureVapidPrivate).Password

try {
    $vapidSubject = Read-Host 'Sujet VAPID (vide = conserver)'
    $guildId = Read-Host 'ID du serveur Discord de production (vide = conserver)'
    $eventsChannel = Read-Host 'ID du salon events (vide = conserver)'
    $newsChannel = Read-Host 'ID du salon news (vide = conserver)'
    $notificationsChannel = Read-Host 'ID du salon notifications (vide = conserver)'
    $discussionChannel = Read-Host 'ID du salon discussion (vide = conserver)'

    $inputLines = @(
        $plainJwt,
        $plainBotKey,
        $plainDiscord,
        $plainOpenAi,
        $plainUex,
        $plainVapidPublic,
        $plainVapidPrivate,
        $vapidSubject,
        $guildId,
        $eventsChannel,
        $newsChannel,
        $notificationsChannel,
        $discussionChannel
    )
    $sshArguments = @(
        '-T',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes',
        '-i', $IdentityFile,
        "$SshUser@$Server",
        "tr -d '\r' | sudo -n /root/iceforge/ops/production/vault/configure-production-secrets.sh --init-json /root/iceforge/.secrets/vault/prod-init.json"
    )
    $inputLines | & ssh @sshArguments
    if ($LASTEXITCODE -ne 0) { throw 'Configuration Vault distante echouee.' }
    Write-Host 'VAULT-PRODUCTION-CONFIG=OK' -ForegroundColor Green
}
finally {
    $plainJwt = $plainBotKey = $plainDiscord = $plainOpenAi = $plainUex = $null
    $plainVapidPublic = $plainVapidPrivate = $inputLines = $null
    foreach ($secureValue in @(
        $secureJwt, $secureBotKey, $secureDiscord, $secureOpenAi, $secureUex,
        $secureVapidPublic, $secureVapidPrivate
    )) {
        $secureValue.Dispose()
    }
}
