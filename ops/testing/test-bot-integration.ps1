[CmdletBinding()]
param(
    [string]$DockerPath,
    [string]$EnvFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectName = 'iceforge_validation'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$EnvFile = if ($EnvFile) { $EnvFile } else { Join-Path $root 'secrets\local.secrets.env' }

if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Fichier d'environnement local introuvable: $EnvFile"
}

if (-not $DockerPath) {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) { $DockerPath = $command.Source }
    else {
        $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $DockerPath = $candidate }
    }
}
if (-not $DockerPath -or -not (Test-Path -LiteralPath $DockerPath -PathType Leaf)) {
    throw 'Docker CLI introuvable.'
}

foreach ($service in @('backend', 'rabbitmq')) {
    $id = (& $DockerPath ps -q `
        --filter "label=com.docker.compose.project=$projectName" `
        --filter "label=com.docker.compose.service=$service").Trim()
    if (-not $id) { throw "Le service local $service de $projectName doit être démarré." }
    $state = (& $DockerPath inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $id).Trim()
    if ($state -notin @('running|healthy', 'running|none')) {
        throw "Le service local $service n'est pas sain: $state"
    }
}

$compose = @(
    'compose', '--env-file', $EnvFile, '-p', $projectName,
    '-f', (Join-Path $root 'docker-compose.yml'),
    '-f', (Join-Path $root 'docker-compose.validation.yml')
)

$testCommand = @'
export BACKEND_TEST_URL=http://backend:8080
export RABBITMQ_TEST_URL="$(python -c 'import os; from urllib.parse import quote; print("amqp://{}:{}@rabbitmq:5672/%2F".format(quote(os.environ["RABBITMQ_USER"], safe=""), quote(os.environ["RABBITMQ_PSWD"], safe="")))')"
python -m unittest discover -s tests -v
'@

& $DockerPath @compose build bot
if ($LASTEXITCODE -ne 0) { throw 'La construction du bot de validation a échoué.' }

& $DockerPath @compose run --rm --no-deps bot sh -lc $testCommand
if ($LASTEXITCODE -ne 0) { throw 'Les tests intégrés du bot ont échoué.' }

Write-Host 'BOT-INTEGRATION=OK'
