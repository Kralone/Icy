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

$secureToken = Read-Host 'Token du bot Discord temporaire' -AsSecureString
$guildId = Read-Host 'ID du serveur Discord temporaire'
$eventsId = Read-Host 'ID salon events (optionnel)'
$newsId = Read-Host 'ID salon news (optionnel)'
$notificationsId = Read-Host 'ID salon notifications (optionnel)'
$discussionId = Read-Host 'ID salon discussion (optionnel)'

if ($guildId -notmatch '^[0-9]{15,22}$') { throw 'ID serveur invalide.' }
foreach ($id in @($eventsId, $newsId, $notificationsId, $discussionId)) {
    if ($id -and $id -notmatch '^[0-9]{15,22}$') { throw 'ID salon invalide.' }
}

$plainToken = [Net.NetworkCredential]::new('', $secureToken).Password
try {
    if (-not $plainToken) { throw 'Token vide refuse.' }
    $inputLines = @($plainToken, $guildId, $eventsId, $newsId, $notificationsId, $discussionId)
    $sshArguments = @('-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $IdentityFile)
    $inputLines | & ssh @sshArguments "$SshUser@$Server" 'sudo -n /opt/iceforge-staging/current/configure-discord.sh'
    if ($LASTEXITCODE -ne 0) { throw 'Configuration Discord distante echouee.' }
} finally {
    $plainToken = $null
    $inputLines = $null
    $secureToken.Dispose()
}
