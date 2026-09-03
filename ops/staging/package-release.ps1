[CmdletBinding()]
param(
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dockerCandidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } elseif (Test-Path -LiteralPath $dockerCandidate) { $dockerCandidate } else { throw 'Docker CLI introuvable.' }

$revision = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[0-9a-f]{40}$') { throw 'Revision Git introuvable.' }
$dirty = (& git -C $repoRoot status --porcelain)
if ($dirty) { throw 'Le depot doit etre propre avant de construire une release.' }

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $env:TEMP "IceForgeStaging-$revision"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw "Le repertoire existe deja: $OutputDirectory" }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

$images = @(
    "iceforge/backend:$revision",
    "iceforge/bot:$revision",
    "iceforge/frontend:$revision"
)

& $docker build --pull=false --tag $images[0] (Join-Path $repoRoot 'icy_backend')
if ($LASTEXITCODE -ne 0) { throw 'Build backend echoue.' }
& $docker build --pull=false --tag $images[1] (Join-Path $repoRoot 'icy')
if ($LASTEXITCODE -ne 0) { throw 'Build bot echoue.' }
& $docker build --pull=false --build-arg "ICEFORGE_BUILD_COMMIT=$revision" --tag $images[2] (Join-Path $repoRoot 'icy-angular')
if ($LASTEXITCODE -ne 0) { throw 'Build frontend echoue.' }

$releaseFiles = @(
    'docker-compose.staging.yml',
    'prepare-env.sh',
    'configure-discord.sh',
    'install-release.sh',
    'deploy.sh',
    'verify.sh',
    'destroy.sh',
    'README.md'
)
foreach ($file in $releaseFiles) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $OutputDirectory
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'ops\testing\validation-fixtures.sql') -Destination $OutputDirectory

$imageArchive = Join-Path $OutputDirectory 'iceforge-images.tar'
& $docker image save --output $imageArchive $images
if ($LASTEXITCODE -ne 0) { throw 'Export des images echoue.' }
$imageSha256 = (Get-FileHash -LiteralPath $imageArchive -Algorithm SHA256).Hash.ToLowerInvariant()

$manifest = [ordered]@{
    revision = $revision
    imageArchive = 'iceforge-images.tar'
    imageArchiveSha256 = $imageSha256
    images = $images
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'release.json') -Encoding utf8NoBOM
Write-Host "Release preparee dans $OutputDirectory"
Write-Host "Revision: $revision"
Write-Host "SHA-256 archive: $imageSha256"
