Set-StrictMode -Version Latest

$script:IceForgeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Get-IceForgeDocker {
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
function Get-IceForgeDevComposeArgs {
    $arguments = @(
        'compose',
        '--project-name', 'iceforge_dev'
    )
    $envFile = Join-Path $script:IceForgeRoot 'secrets\local.secrets.env'
    if (Test-Path -LiteralPath $envFile) {
        $arguments += @('--env-file', $envFile)
    }
    $arguments += @(
        '-f', (Join-Path $script:IceForgeRoot 'docker-compose.yml'),
        '-f', (Join-Path $script:IceForgeRoot 'docker-compose.override.yml'),
        '-f', (Join-Path $script:IceForgeRoot 'docker-compose.dev.yml')
    )
    return $arguments
}
