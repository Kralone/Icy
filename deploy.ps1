param(
    [string]$Target = ""
)

# === CONFIGURATION ===
$ServerUser = "root"
$ServerIP = "82.29.170.11"
$RemoteDir = "/root/iceforge"
$ArchiveName = "iceforge.tar.gz"
$JarName = "iceforge-backend-1.0.0.jar"
$BackendDir = "icy_backend"
$DeployTmp = "deploy_tmp"

function Prepare-Archive {
    Write-Host "==> Preparation..."

    if (-Not (Test-Path "$BackendDir\target\$JarName")) {
        Write-Error "Jar introuvable. Build dans IntelliJ d'abord."
        exit 1
    }

    Remove-Item -Recurse -Force $DeployTmp -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path "$DeployTmp\$BackendDir" | Out-Null

    Copy-Item "$BackendDir\target\$JarName" "$DeployTmp\$BackendDir\app.jar"
    Copy-Item "$BackendDir\Dockerfile" "$DeployTmp\$BackendDir\"
    Copy-Item "docker-compose.yml" "$DeployTmp\"

    & tar -czf $ArchiveName -C $DeployTmp .
    if ($LASTEXITCODE -ne 0) { throw "Erreur tar" }

    Remove-Item -Recurse -Force $DeployTmp
}

function Deploy {
    Write-Host "==> Envoi..."
    & scp $ArchiveName "${ServerUser}@${ServerIP}:/tmp/"

    Write-Host "==> Deploiement..."
    $ssh = @"
set -e
mkdir -p $RemoteDir
cd $RemoteDir
docker compose down || true
tar -xzf /tmp/$ArchiveName -C $RemoteDir
rm /tmp/$ArchiveName
docker compose up -d --build
"@

    $ssh = $ssh -replace "`r", ""
    & ssh "${ServerUser}@${ServerIP}" $ssh

    Remove-Item $ArchiveName
    Write-Host "✅ Terminé."
}

switch ($Target) {
    "" { Prepare-Archive; Deploy }
    "b" { Prepare-Archive; Deploy }
    default {
        Write-Host "Usage :"
        Write-Host "  .\deploy.ps1       -> tout"
        Write-Host "  .\deploy.ps1 b     -> juste le backend"
        exit 1
    }
}
