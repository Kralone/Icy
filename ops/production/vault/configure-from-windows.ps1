[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server,
    [string]$SshUser = 'iceforge-ops',
    [Parameter(Mandatory)][string]$IdentityFile,
    [switch]$GenerateLocalSecrets
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
if ($SshUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Utilisateur SSH invalide.' }

function ConvertTo-Base64Url {
    param([Parameter(Mandatory)][byte[]]$Bytes)
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-RandomSecret {
    param([int]$ByteCount = 48)
    $bytes = New-Object byte[] $ByteCount
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
        return ConvertTo-Base64Url $bytes
    }
    finally {
        $random.Dispose()
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function New-VapidKeyPair {
    $algorithm = New-Object Security.Cryptography.ECDsaCng
    try {
        $algorithm.KeySize = 256
        $parameters = $algorithm.ExportParameters($true)
        $publicBytes = New-Object byte[] 65
        $publicBytes[0] = 4
        [Array]::Copy($parameters.Q.X, 0, $publicBytes, 1, 32)
        [Array]::Copy($parameters.Q.Y, 0, $publicBytes, 33, 32)
        return [pscustomobject]@{
            PublicKey = ConvertTo-Base64Url $publicBytes
            PrivateKey = ConvertTo-Base64Url $parameters.D
        }
    }
    finally {
        $algorithm.Dispose()
    }
}

$secureJwt = $secureBotKey = $secureDiscord = $secureOpenAi = $secureUex = $null
$secureVapidPublic = $secureVapidPrivate = $null
$plainJwt = $plainBotKey = $plainDiscord = $plainOpenAi = $plainUex = $null
$plainVapidPublic = $plainVapidPrivate = $inputLines = $null

try {
    Write-Host 'Laissez les tokens fournisseurs vides pour conserver leur valeur Vault actuelle.'
    if ($GenerateLocalSecrets) {
        $plainJwt = New-RandomSecret
        $plainBotKey = New-RandomSecret
        $vapid = New-VapidKeyPair
        $plainVapidPublic = $vapid.PublicKey
        $plainVapidPrivate = $vapid.PrivateKey
        $vapid = $null
        Write-Host 'Nouveaux secrets JWT, backend/bot et VAPID generes localement (valeurs non affichees).'
    }
    else {
        $secureJwt = Read-Host 'Secret JWT (masque, vide = conserver)' -AsSecureString
        $secureBotKey = Read-Host 'Cle partagee backend/bot (masquee, vide = conserver)' -AsSecureString
        $secureVapidPublic = Read-Host 'Cle publique VAPID (masquee, vide = conserver)' -AsSecureString
        $secureVapidPrivate = Read-Host 'Cle privee VAPID (masquee, vide = conserver)' -AsSecureString
        $plainJwt = [Net.NetworkCredential]::new('', $secureJwt).Password
        $plainBotKey = [Net.NetworkCredential]::new('', $secureBotKey).Password
        $plainVapidPublic = [Net.NetworkCredential]::new('', $secureVapidPublic).Password
        $plainVapidPrivate = [Net.NetworkCredential]::new('', $secureVapidPrivate).Password
    }

    $secureDiscord = Read-Host 'Nouveau token Discord (masque, vide = conserver)' -AsSecureString
    $secureOpenAi = Read-Host 'Nouvelle cle OpenAI (masquee, vide = conserver)' -AsSecureString
    $secureUex = Read-Host 'Nouvelle cle UEX (masquee, vide = conserver)' -AsSecureString
    $plainDiscord = [Net.NetworkCredential]::new('', $secureDiscord).Password
    $plainOpenAi = [Net.NetworkCredential]::new('', $secureOpenAi).Password
    $plainUex = [Net.NetworkCredential]::new('', $secureUex).Password

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
    ) | Where-Object { $null -ne $_ }) {
        $secureValue.Dispose()
    }
}
