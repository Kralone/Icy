[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9.-]+$')][string]$Server = '82.29.170.11',
    [ValidatePattern('^[a-z_][a-z0-9_-]*$')][string]$SshUser = 'iceforge-ops',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\iceforge_ops_ed25519",
    [Parameter(DontShow)][switch]$DisplayInCurrentWindow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
if (-not $DisplayInCurrentWindow) {
    $shell = (Get-Process -Id $PID).Path
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Server {1} -SshUser {2} -IdentityFile "{3}" -DisplayInCurrentWindow' -f `
        $PSCommandPath, $Server, $SshUser, $IdentityFile
    Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Normal | Out-Null
    Write-Host 'Une fenêtre PowerShell séparée affiche la clé de déverrouillage. Fermez-la après sauvegarde.'
    return
}

try {
    $Host.UI.RawUI.WindowTitle = 'IceForge — clé de déverrouillage Vault'
    Write-Host 'Clé confidentielle : sauvegardez-la dans votre gestionnaire de mots de passe.' -ForegroundColor Yellow
    Write-Host 'Il s''agit de la clé unseal, pas du token root ni de la clé SSH.'
    Write-Host ''
    # Deliberately inherit this separate console: never return the key to the calling session.
    & ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -i $IdentityFile `
        "$SshUser@$Server" 'sudo -n python3 /root/iceforge/ops/production/vault/vault-recovery.py show-key'
    if ($LASTEXITCODE -ne 0) { throw 'Lecture impossible. Vérifier SSH et le fichier d''initialisation root-only.' }
}
catch {
    Write-Host 'Impossible de récupérer la clé. Vérifiez SSH et le script installé sur le VPS.' -ForegroundColor Red
}
finally {
    Write-Host ''
    Read-Host 'Appuyez sur Entrée pour fermer cette fenêtre après sauvegarde' | Out-Null
    Clear-Host
}
