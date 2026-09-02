[CmdletBinding()]
param([string]$DockerPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectName = 'iceforge_admin_bootstrap_test'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFiles = @(
    (Join-Path $root 'docker-compose.yml'),
    (Join-Path $PSScriptRoot 'docker-compose.admin-bootstrap-test.yml')
)

function Resolve-DockerExecutable {
    if ($DockerPath) { return (Resolve-Path -LiteralPath $DockerPath).Path }
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    throw 'Docker CLI introuvable.'
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    & $script:Docker compose -p $projectName -f $composeFiles[0] -f $composeFiles[1] @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose a échoué: $($Arguments -join ' ')" }
}

$script:Docker = Resolve-DockerExecutable
$ownedVolumeNames = @(
    'iceforge_admin_bootstrap_test_postgres18_data',
    'iceforge_admin_bootstrap_test_rabbitmq_data',
    'iceforge_admin_bootstrap_test_backend_logs',
    'iceforge_admin_bootstrap_test_images_data'
)
$existing = @(& $script:Docker ps -aq --filter "label=com.docker.compose.project=$projectName")
if (@($existing | Where-Object { $_ }).Count -gt 0) {
    throw "Refus: une pile $projectName existe déjà. Nettoyez-la explicitement avant le test."
}
$existingVolumes = @(& $script:Docker volume ls -q --filter "name=^iceforge_admin_bootstrap_test_") |
    Where-Object { $_ -in $ownedVolumeNames }
if (@($existingVolumes).Count -gt 0) {
    throw "Refus: des volumes de la pile $projectName existent déjà. Nettoyez-les explicitement avant le test."
}

$temporaryPassword = 'Aa!' + [Guid]::NewGuid().ToString('N')
$securePassword = ConvertTo-SecureString $temporaryPassword -AsPlainText -Force
$previousFlywayTarget = $env:ICEFORGE_ADMIN_TEST_FLYWAY_TARGET

try {
    Invoke-Compose up -d --wait db rabbitmq
    $dbContainer = (& $script:Docker ps -q --filter "label=com.docker.compose.project=$projectName" --filter 'label=com.docker.compose.service=db').Trim()
    if (-not $dbContainer) { throw 'Conteneur PostgreSQL de test introuvable.' }

    $labels = (& $script:Docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' $dbContainer).Trim()
    if ($labels -ne "$projectName|db") { throw 'Les labels du conteneur PostgreSQL de test sont invalides.' }

    # Emulate a legacy non-empty database without Flyway history. With the
    # retained baseline-on-migrate=true, Flyway must baseline V1 then run V2+.
    Get-Content -Raw -LiteralPath (Join-Path $root 'icy_backend\src\main\resources\db\migration\V1__init_db.sql') |
        & $script:Docker exec -i $dbContainer psql -X -v ON_ERROR_STOP=1 -U iceforge_bootstrap_test -d iceforge_bootstrap_test
    if ($LASTEXITCODE -ne 0) { throw 'Préparation du schéma historique V1 échouée.' }

    $env:ICEFORGE_ADMIN_TEST_FLYWAY_TARGET = '28'
    Invoke-Compose up -d --no-build --wait backend

    $migrationState = (& $script:Docker exec $dbContainer psql -X -U iceforge_bootstrap_test -d iceforge_bootstrap_test -Atc "SELECT count(*) || '|' || min(version::integer) || '|' || max(version::integer) || '|' || bool_and(success) FROM public.flyway_schema_history").Trim()
    if ($migrationState -ne '28|1|28|true') {
        throw "Historique Flyway inattendu après baseline puis migration V28: $migrationState"
    }

    & (Join-Path $root 'ops\admin\bootstrap-local-admin.ps1') `
        -ProjectName $projectName `
        -Username bootstrap_test_admin `
        -DiscordId 999999999999999991 `
        -Password $securePassword `
        -Confirm:$false

    Get-Content -Raw -LiteralPath (Join-Path $root 'ops\production\backend-rollout\verify-v29-admin-readiness.sql') |
        & $script:Docker exec -i $dbContainer psql -X -v ON_ERROR_STOP=1 -U iceforge_bootstrap_test -d iceforge_bootstrap_test
    if ($LASTEXITCODE -ne 0) { throw 'Le précontrôle de continuité administrateur V29 a échoué.' }

    $env:ICEFORGE_ADMIN_TEST_FLYWAY_TARGET = '29'
    Invoke-Compose up -d --no-build --force-recreate --wait backend

    $migrationState = (& $script:Docker exec $dbContainer psql -X -U iceforge_bootstrap_test -d iceforge_bootstrap_test -Atc "SELECT count(*) || '|' || min(version::integer) || '|' || max(version::integer) || '|' || bool_and(success) FROM public.flyway_schema_history").Trim()
    if ($migrationState -ne '29|1|29|true') {
        throw "Historique Flyway inattendu après migration V29: $migrationState"
    }

    $legacyState = (& $script:Docker exec $dbContainer psql -X -U iceforge_bootstrap_test -d iceforge_bootstrap_test -Atc "SELECT active || '|' || pwd_reset || '|' || (password LIKE '{DISABLED_BY_V29}%') || '|' || (SELECT count(*) FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='ADMIN') FROM core.users u WHERE username='Kralone' AND discord_id='190174996235026433'").Trim()
    if ($legacyState -ne 'false|true|true|0') {
        throw "Le seed historique n'a pas été neutralisé exactement comme prévu: $legacyState"
    }

    $passwordLiteral = '$iceforge_test$' + $temporaryPassword + '$iceforge_test$'
    $adminQuery = "SELECT active || '|' || pwd_reset || '|' || (password = crypt($passwordLiteral, password)) || '|' || (SELECT count(*) FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='ADMIN') FROM core.users u WHERE username='bootstrap_test_admin' AND discord_id='999999999999999991'"
    $adminState = (& $script:Docker exec $dbContainer psql -X -U iceforge_bootstrap_test -d iceforge_bootstrap_test -Atc $adminQuery).Trim()
    if ($adminState -ne 'true|true|true|1') {
        throw "L'administrateur amorcé n'est pas conforme: $adminState"
    }

    Write-Host 'ADMIN-BOOTSTRAP-E2E=OK'
    Write-Host 'V29-ADMIN-READINESS=OK'
    Write-Host 'FLYWAY-BASELINE-V1-TO-V29=OK'
} finally {
    $temporaryPassword = $null
    $securePassword.Dispose()
    $env:ICEFORGE_ADMIN_TEST_FLYWAY_TARGET = $previousFlywayTarget
    $ownedContainers = @(& $script:Docker ps -aq --filter "label=com.docker.compose.project=$projectName")
    if (@($ownedContainers | Where-Object { $_ }).Count -gt 0) {
        Invoke-Compose down -v --remove-orphans
    }
    $ownedVolumes = @(& $script:Docker volume ls -q --filter "name=^iceforge_admin_bootstrap_test_") |
        Where-Object { $_ -in $ownedVolumeNames }
    foreach ($volume in @($ownedVolumes)) {
        $owner = (& $script:Docker volume inspect --format '{{index .Labels "com.docker.compose.project"}}' $volume).Trim()
        if ($owner -ne $projectName) {
            throw "Refus de supprimer un volume sans label de propriété exact: $volume"
        }
        & $script:Docker volume rm $volume | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Suppression du volume temporaire échouée: $volume" }
    }
}
