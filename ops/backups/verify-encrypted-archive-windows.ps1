[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Archive,
    [Parameter(Mandatory)][string]$IdentityFile,
    [Parameter(Mandatory)][string]$AgePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

foreach ($path in @($Archive, $IdentityFile, $AgePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Fichier absent: $path"
    }
}

function Quote-NativeArgument {
    param([Parameter(Mandatory)][string]$Value)
    return '"' + $Value.Replace('"', '\"') + '"'
}

$age = New-Object System.Diagnostics.Process
$age.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
$age.StartInfo.FileName = (Resolve-Path -LiteralPath $AgePath).Path
$age.StartInfo.Arguments = '--decrypt -i ' +
    (Quote-NativeArgument (Resolve-Path -LiteralPath $IdentityFile).Path) + ' ' +
    (Quote-NativeArgument (Resolve-Path -LiteralPath $Archive).Path)
$age.StartInfo.UseShellExecute = $false
$age.StartInfo.RedirectStandardOutput = $true
$age.StartInfo.RedirectStandardError = $false
$age.StartInfo.RedirectStandardInput = $false

$tar = New-Object System.Diagnostics.Process
$tar.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
$tar.StartInfo.FileName = 'tar.exe'
$tar.StartInfo.Arguments = '-tzf -'
$tar.StartInfo.UseShellExecute = $false
$tar.StartInfo.RedirectStandardInput = $true
$tar.StartInfo.RedirectStandardOutput = $true
$tar.StartInfo.RedirectStandardError = $false
$ageStarted = $false
$tarStarted = $false

try {
    if (-not $tar.Start()) { throw 'Impossible de démarrer tar.exe.' }
    $tarStarted = $true
    $discardedListing = $tar.StandardOutput.ReadToEndAsync()
    if (-not $age.Start()) { throw 'Impossible de démarrer age.' }
    $ageStarted = $true

    $copy = $age.StandardOutput.BaseStream.CopyToAsync($tar.StandardInput.BaseStream)
    $copy.GetAwaiter().GetResult()
    $tar.StandardInput.Close()
    $age.WaitForExit()
    $tar.WaitForExit()
    $null = $discardedListing.GetAwaiter().GetResult()

    if ($age.ExitCode -ne 0) { throw "Déchiffrement age échoué (code $($age.ExitCode))." }
    if ($tar.ExitCode -ne 0) { throw "Lecture tar échouée (code $($tar.ExitCode))." }
    Write-Host 'RESTORE-ARCHIVE-READ=OK' -ForegroundColor Green
}
finally {
    if ($ageStarted -and -not $age.HasExited) { $age.Kill() }
    if ($tarStarted -and -not $tar.HasExited) { $tar.Kill() }
    $age.Dispose()
    $tar.Dispose()
}
