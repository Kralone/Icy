[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PackageDirectory,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server,
    [string]$SshUser = 'iceforge-ops',
    [Parameter(Mandatory)][string]$IdentityFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PackageDirectory = (Resolve-Path -LiteralPath $PackageDirectory).Path
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
if ($SshUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Utilisateur SSH invalide.' }

$manifestPath = Join-Path $PackageDirectory 'release.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$revision = [string]$manifest.revision
$expectedSha256 = [string]$manifest.imageArchiveSha256
if ($revision -notmatch '^[0-9a-f]{40}$' -or $expectedSha256 -notmatch '^[0-9a-f]{64}$') { throw 'Manifest de release invalide.' }
$archive = Join-Path $PackageDirectory ([string]$manifest.imageArchive)
$actualSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) { throw 'SHA-256 local de l archive incorrect.' }

$required = @(
    'docker-compose.staging.yml', 'prepare-env.sh', 'install-release.sh',
    'deploy.sh', 'verify.sh', 'destroy.sh', 'validation-fixtures.sql',
    'README.md', 'release.json', 'iceforge-images.tar'
)
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $PackageDirectory $file) -PathType Leaf)) {
        throw "Fichier de release absent: $file"
    }
}

$sshTarget = "$SshUser@$Server"
$uploadDir = "/home/$SshUser/iceforge-staging-$revision"
$sshOptions = @('-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $IdentityFile)
& ssh @sshOptions $sshTarget "install -d -m 0700 '$uploadDir'"
if ($LASTEXITCODE -ne 0) { throw 'Creation du repertoire de transit echouee.' }
& scp -q -o BatchMode=yes -o StrictHostKeyChecking=yes -i $IdentityFile ($required | ForEach-Object { Join-Path $PackageDirectory $_ }) "${sshTarget}:${uploadDir}/"
if ($LASTEXITCODE -ne 0) { throw 'Transfert de la release echoue.' }

$remote = "sudo -n install -d -m 0750 /opt/iceforge-staging/releases/$revision; " +
          "sudo -n install -o root -g root -m 0640 $uploadDir/docker-compose.staging.yml $uploadDir/validation-fixtures.sql $uploadDir/README.md $uploadDir/release.json /opt/iceforge-staging/releases/$revision/; " +
          "sudo -n install -o root -g root -m 0750 $uploadDir/prepare-env.sh $uploadDir/install-release.sh $uploadDir/deploy.sh $uploadDir/verify.sh $uploadDir/destroy.sh /opt/iceforge-staging/releases/$revision/; " +
          "sudo -n /opt/iceforge-staging/releases/$revision/install-release.sh --revision $revision --image-archive $uploadDir/iceforge-images.tar --sha256 $expectedSha256"
& ssh @sshOptions $sshTarget $remote
if ($LASTEXITCODE -ne 0) { throw 'Installation distante de la release echouee.' }
Write-Host "Release $revision installee sur $Server sans demarrer de service."
