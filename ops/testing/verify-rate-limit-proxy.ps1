[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://127.0.0.1:8088',
    [string]$DockerPath,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$parsedBaseUrl = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$parsedBaseUrl) -or
    $parsedBaseUrl.Scheme -ne 'http' -or
    $parsedBaseUrl.Host -notin @('127.0.0.1', 'localhost', '::1') -or
    $parsedBaseUrl.Port -ne 8088) {
    throw 'Refus: ce test destructif de quota accepte uniquement http://127.0.0.1:8088 (ou localhost/[::1]).'
}
$BaseUrl = $BaseUrl.TrimEnd('/')
$EnvFile = if ($EnvFile) { $EnvFile } else { Join-Path $root 'secrets\local.secrets.env' }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Fichier d'environnement local introuvable: $EnvFile"
}

if (-not $DockerPath) {
    $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCommand) {
        $DockerPath = $dockerCommand.Source
    } else {
        $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $DockerPath = $candidate }
    }
}
if (-not $DockerPath -or -not (Test-Path -LiteralPath $DockerPath -PathType Leaf)) {
    throw 'docker.exe est introuvable; utiliser -DockerPath.'
}

$compose = @(
    'compose', '--env-file', $EnvFile, '-p', 'iceforge_validation',
    '-f', (Join-Path $root 'docker-compose.yml'),
    '-f', (Join-Path $root 'docker-compose.override.yml'),
    '-f', (Join-Path $root 'docker-compose.validation.yml')
)

Push-Location $root
try {
    # Recreate containers (never volumes) so an older dynamically-addressed
    # validation network cannot survive the migration to a fixed subnet.
    & $DockerPath @compose down --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw 'La pile de validation ne peut pas etre arretee proprement.' }

    # Start every non-profile service so Compose can safely recreate the fixed
    # validation network if an older dynamically-addressed stack is present.
    & $DockerPath @compose up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'La pile de validation ne demarre pas.' }

    # Reset only the in-memory limiter. The validation database is not modified.
    & $DockerPath @compose restart backend
    if ($LASTEXITCODE -ne 0) { throw 'Le backend ne redemarre pas.' }
    & $DockerPath @compose up -d --wait backend frontend
    if ($LASTEXITCODE -ne 0) { throw 'La pile ne redevient pas saine.' }

    $frontendId = (& $DockerPath @compose ps -q frontend).Trim()
    $backendId = (& $DockerPath @compose ps -q backend).Trim()
    if (-not $frontendId -or -not $backendId) { throw 'Conteneurs frontend/backend introuvables.' }

    $networks = (& $DockerPath inspect --format '{{json .NetworkSettings.Networks}}' $frontendId) | ConvertFrom-Json
    $proxyAddress = $networks.iceforge_validation_internal.IPAddress
    $trustedProxy = (& $DockerPath exec $backendId printenv ICY_RATE_LIMIT_TRUSTED_PROXIES).Trim()
    if ($trustedProxy -ne "$proxyAddress/32") {
        throw "Le backend ne fait pas confiance uniquement au proxy exact attendu."
    }

    $identity = 'rate-limit-proxy-check-' + [Guid]::NewGuid().ToString('N')
    $payload = @{ username = $identity; password = 'synthetic-invalid-password' } | ConvertTo-Json -Compress

    for ($attempt = 1; $attempt -le 10; $attempt++) {
        # Every forged value must be discarded by the public-edge Nginx config.
        $response = Invoke-WebRequest -SkipHttpErrorCheck -Method Post `
            -Uri "$BaseUrl/api/auth/login" -ContentType 'application/json' `
            -Headers @{ 'X-Forwarded-For' = "203.0.113.$attempt" } -Body $payload
        if ($response.StatusCode -ne 401) {
            throw "Tentative $attempt : HTTP 401 attendu, obtenu $($response.StatusCode)."
        }
    }

    $blocked = Invoke-WebRequest -SkipHttpErrorCheck -Method Post `
        -Uri "$BaseUrl/api/auth/login" -ContentType 'application/json' `
        -Headers @{ 'X-Forwarded-For' = '198.51.100.250' } -Body $payload
    if ($blocked.StatusCode -ne 429 -or -not $blocked.Headers['Retry-After']) {
        throw "Le 11e echec via Nginx doit produire 429 avec Retry-After."
    }
    if ($blocked.Content -match [Regex]::Escape($identity) -or
        $blocked.Content -match 'synthetic-invalid-password') {
        throw 'La reponse 429 expose un identifiant ou un secret.'
    }

    Write-Host "OK: proxy $proxyAddress exact, X-Forwarded-For forge ignore, quota HTTP 429 valide."
}
finally {
    Pop-Location
}
