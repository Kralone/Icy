[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)]
    [ValidateSet('iceforge_dev', 'iceforge_validation', 'iceforge_admin_bootstrap_test')]
    [string]$ProjectName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9_.-]{3,50}$')]
    [string]$Username,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]{15,22}$')]
    [string]$DiscordId,

    [Security.SecureString]$Password
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$legacyUsername = 'Kralone'
$legacyDiscordId = '190174996235026433'
$legacyPasswordHash = '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C'
$allowedProjects = @('iceforge_dev', 'iceforge_validation', 'iceforge_admin_bootstrap_test')

function Get-DockerExecutable {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    throw 'Docker CLI introuvable. Démarrez Docker Desktop puis rouvrez le terminal.'
}

function New-DollarQuotedLiteral {
    param([Parameter(Mandatory)][string]$Value)

    do {
        $tag = '$iceforge_' + [Guid]::NewGuid().ToString('N') + '$'
    } while ($Value.Contains($tag, [StringComparison]::Ordinal))

    return "$tag$Value$tag"
}

if ($allowedProjects -notcontains $ProjectName) {
    throw 'Refus: ce script est réservé aux piles locales IceForge explicitement autorisées.'
}

$docker = Get-DockerExecutable
$containerId = (& $docker ps --filter "label=com.docker.compose.project=$ProjectName" --filter 'label=com.docker.compose.service=db' --format '{{.ID}}' | Select-Object -First 1).Trim()
if (-not $containerId) {
    throw "La base locale $ProjectName n'est pas démarrée."
}

$actualProject = (& $docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' $containerId).Trim()
$actualService = (& $docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' $containerId).Trim()
if ($actualProject -ne $ProjectName -or $actualService -ne 'db') {
    throw 'Refus: le conteneur sélectionné ne correspond pas exactement à la base locale demandée.'
}

$dbUser = (& $docker exec $containerId printenv POSTGRES_USER).Trim()
$dbName = (& $docker exec $containerId printenv POSTGRES_DB).Trim()
if (-not $dbUser -or -not $dbName) {
    throw 'POSTGRES_USER ou POSTGRES_DB est absent du conteneur local.'
}

$existingAdminQuery = @"
SELECT count(*)
FROM core.users u
JOIN core.user_roles ur ON ur.user_id = u.id
JOIN core.roles r ON r.id = ur.role_id
WHERE r.name = 'ADMIN'
  AND u.active = true
  AND NOT (
    u.username = '$legacyUsername'
    AND u.discord_id = '$legacyDiscordId'
    AND u.password = '$legacyPasswordHash'
  );
"@
$existingAdminCount = (& $docker exec $containerId psql -X -U $dbUser -d $dbName -Atc $existingAdminQuery).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Impossible de vérifier les administrateurs existants dans $ProjectName."
}
if ($existingAdminCount -ne '0') {
    throw "Refus: $ProjectName possède déjà un administrateur non hérité. Aucun compte n'a été modifié."
}

$target = "administrateur local '$Username' dans $ProjectName"
if (-not $PSCmdlet.ShouldProcess($target, 'Créer le compte, attribuer ADMIN et désactiver le seed historique exact')) {
    return
}

$passwordWasPrompted = -not $Password
if ($passwordWasPrompted) {
    $Password = Read-Host 'Mot de passe temporaire du nouvel administrateur' -AsSecureString
    $confirmation = Read-Host 'Confirmez le mot de passe temporaire' -AsSecureString
    $plainPassword = [Net.NetworkCredential]::new('', $Password).Password
    $plainConfirmation = [Net.NetworkCredential]::new('', $confirmation).Password
    if ($plainPassword -cne $plainConfirmation) {
        throw 'Les mots de passe ne correspondent pas.'
    }
    $plainConfirmation = $null
    $confirmation.Dispose()
} else {
    $plainPassword = [Net.NetworkCredential]::new('', $Password).Password
}

try {
    if ($plainPassword.Length -lt 12) {
        throw 'Le mot de passe temporaire doit contenir au moins 12 caractères.'
    }
    if ([Text.Encoding]::UTF8.GetByteCount($plainPassword) -gt 72) {
        throw 'Le mot de passe dépasse la limite BCrypt de 72 octets UTF-8.'
    }

    $usernameSql = New-DollarQuotedLiteral $Username
    $discordIdSql = New-DollarQuotedLiteral $DiscordId
    $passwordSql = New-DollarQuotedLiteral $plainPassword
    $legacyUsernameSql = New-DollarQuotedLiteral $legacyUsername
    $legacyDiscordIdSql = New-DollarQuotedLiteral $legacyDiscordId
    $legacyHashSql = New-DollarQuotedLiteral $legacyPasswordHash

    $sql = @"
\set ON_ERROR_STOP on
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO `$iceforge_bootstrap`$
DECLARE
    target_user_id uuid;
    admin_role_id uuid;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM core.users u
        JOIN core.user_roles ur ON ur.user_id = u.id
        JOIN core.roles r ON r.id = ur.role_id
        WHERE r.name = 'ADMIN'
          AND u.active = true
          AND NOT (
            u.username = $legacyUsernameSql
            AND u.discord_id = $legacyDiscordIdSql
            AND u.password = $legacyHashSql
          )
    ) THEN
        RAISE EXCEPTION 'A non-legacy active administrator already exists';
    END IF;

    IF EXISTS (SELECT 1 FROM core.users WHERE username = $usernameSql AND discord_id <> $discordIdSql) THEN
        RAISE EXCEPTION 'The requested username belongs to another Discord account';
    END IF;
    IF EXISTS (SELECT 1 FROM core.users WHERE discord_id = $discordIdSql AND username <> $usernameSql) THEN
        RAISE EXCEPTION 'The requested Discord account belongs to another username';
    END IF;

    SELECT id INTO admin_role_id FROM core.roles WHERE name = 'ADMIN';
    IF admin_role_id IS NULL THEN
        RAISE EXCEPTION 'The ADMIN role is missing';
    END IF;

    INSERT INTO core.users (username, discord_id, password, active, pwd_reset)
    VALUES ($usernameSql, $discordIdSql, crypt($passwordSql, gen_salt('bf', 12)), true, true)
    ON CONFLICT (discord_id) DO UPDATE
      SET password = EXCLUDED.password,
          active = true,
          pwd_reset = true
    WHERE core.users.username = EXCLUDED.username
    RETURNING id INTO target_user_id;

    IF target_user_id IS NULL THEN
        SELECT id INTO target_user_id
        FROM core.users
        WHERE username = $usernameSql AND discord_id = $discordIdSql;
    END IF;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Unable to create or identify the requested administrator';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM core.user_roles
        WHERE user_id = target_user_id AND role_id = admin_role_id
    ) THEN
        INSERT INTO core.user_roles (user_id, role_id)
        VALUES (target_user_id, admin_role_id);
    END IF;

    IF NOT ($usernameSql = $legacyUsernameSql AND $discordIdSql = $legacyDiscordIdSql) THEN
        DELETE FROM core.user_roles ur
        USING core.users u
        WHERE ur.user_id = u.id
          AND ur.role_id = admin_role_id
          AND u.username = $legacyUsernameSql
          AND u.discord_id = $legacyDiscordIdSql
          AND u.password = $legacyHashSql;

        UPDATE core.users
        SET active = false,
            pwd_reset = true
        WHERE username = $legacyUsernameSql
          AND discord_id = $legacyDiscordIdSql
          AND password = $legacyHashSql;
    END IF;
END
`$iceforge_bootstrap`$;

COMMIT;
"@

    $sql | & $docker exec -i $containerId psql -X -U $dbUser -d $dbName
    if ($LASTEXITCODE -ne 0) {
        throw "L'amorçage de l'administrateur local a échoué; la transaction a été annulée."
    }
    Write-Host "Administrateur local '$Username' amorcé dans $ProjectName. Le changement de mot de passe est obligatoire à la première connexion."
} finally {
    $plainPassword = $null
    if ($passwordWasPrompted -and $Password) {
        $Password.Dispose()
    }
}
