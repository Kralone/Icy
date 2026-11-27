# Purge des copies de sauvegarde gardées sur un PC Windows, avec la même règle
# que le serveur (politique de confidentialité) : supprimer les bundles de plus
# de 6 mois, en gardant toujours la plus récente.
#
#   .\prune-old-archives-windows.ps1 -Directory 'D:\Sauvegardes\IceForge'          # liste seulement
#   .\prune-old-archives-windows.ps1 -Directory 'D:\Sauvegardes\IceForge' -Apply   # supprime
#
# À lancer juste après avoir copié une nouvelle sauvegarde, ou chaque semaine
# avec le Planificateur de tâches.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Directory,
    [ValidateRange(30, 3650)][int]$MaxAgeDays = 183,
    [ValidateRange(1, 100)][int]$Keep = 1,
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    throw "Dossier absent: $Directory"
}

# La date vient du nom (iceforge-AAAAMMJJTHHMMSSZ.tar.gz.age) : une copie récente
# d'une vieille sauvegarde garde ainsi son âge réel. À défaut, date du fichier.
function Get-BackupDate {
    param([Parameter(Mandatory)][System.IO.FileInfo]$File)
    if ($File.Name -match '^iceforge-(\d{8}T\d{6})Z\.tar\.gz\.age$') {
        return [datetime]::ParseExact($Matches[1], 'yyyyMMddTHHmmss',
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::AssumeUniversal)
    }
    return $File.LastWriteTime
}

$cutoff = (Get-Date).AddDays(-$MaxAgeDays)
$archives = @(Get-ChildItem -LiteralPath $Directory -File -Filter 'iceforge-*.tar.gz.age' |
    ForEach-Object { [pscustomobject]@{ File = $_; Date = Get-BackupDate $_ } } |
    Sort-Object Date -Descending)

$removed = 0
for ($index = $Keep; $index -lt $archives.Count; $index++) {
    $archive = $archives[$index].File
    if ($archives[$index].Date -ge $cutoff) { continue }
    $checksum = $archive.FullName + '.sha256'
    if ($Apply) {
        Remove-Item -LiteralPath $archive.FullName -Force
        if (Test-Path -LiteralPath $checksum -PathType Leaf) { Remove-Item -LiteralPath $checksum -Force }
        Write-Output "Supprimé: $($archive.Name)"
    } else {
        Write-Output "À supprimer: $($archive.Name)"
    }
    $removed++
}

$mode = if ($Apply) { 'APPLY' } else { 'DRY-RUN' }
Write-Output "PRUNE=$mode removed=$removed kept_recent=$Keep max_age_days=$MaxAgeDays"
