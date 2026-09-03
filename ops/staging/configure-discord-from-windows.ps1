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
$guildId = '481939578811449346'
$channelId = '682666033827414089'

$plainToken = [Net.NetworkCredential]::new('', $secureToken).Password
try {
    if (-not $plainToken) { throw 'Token vide refuse.' }
    $inputLines = @($plainToken, $guildId, $channelId, $channelId, $channelId, $channelId)
    $sshArguments = @('-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $IdentityFile)
    # Windows PowerShell writes CRLF to native pipelines. Strip CR remotely so
    # Bash receives exact Discord IDs without retaining the token anywhere.
    $inputLines | & ssh @sshArguments "$SshUser@$Server" "tr -d '\r' | sudo -n /opt/iceforge-staging/current/configure-discord.sh"
    if ($LASTEXITCODE -ne 0) { throw 'Configuration Discord distante echouee.' }
} finally {
    $plainToken = $null
    $inputLines = $null
    $secureToken.Dispose()
}
