# Synthetic SSH and prompt responses only. Never contacts a server or opens a window.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$unseal = Join-Path $repo 'ops\production\vault\unseal-from-windows.ps1'
$show = Join-Path $repo 'ops\production\vault\show-unseal-key-window.ps1'
$global:VaultRecoveryTestScenario = 'open'
$global:VaultRecoveryTestPromptCount = 0
$global:VaultRecoveryTestPostCount = 0
$global:VaultRecoveryTestCapturedPayload = $null
$global:VaultRecoveryTestDummyKey = [Convert]::ToBase64String((New-Object byte[] 32))
$global:VaultRecoveryTestWindowArguments = $null
$global:VaultRecoveryTestWindowStyle = $null

function Assert-True($condition, $message) {
    if (-not $condition) { throw $message }
}
function ssh {
    $global:LASTEXITCODE = 0
    if ($args[-1] -match ' status$') {
        if ($global:VaultRecoveryTestScenario -eq 'open') { return '{"initialized":true,"sealed":false,"t":1,"progress":0}' }
        return '{"initialized":true,"sealed":true,"t":3,"progress":0}'
    }
    if ($args[-1] -notmatch ' unseal$') { throw 'Unexpected SSH command; no display of keys is allowed in tests.' }
    $global:VaultRecoveryTestCapturedPayload = (@($input) -join "`n") | ConvertFrom-Json
    $global:VaultRecoveryTestPostCount++
    if ($global:VaultRecoveryTestScenario -eq 'failure') { $global:LASTEXITCODE = 1; return }
    if ($global:VaultRecoveryTestScenario -eq 'partial') { return '{"initialized":true,"sealed":true,"t":3,"progress":1}' }
    return '{"initialized":true,"sealed":false,"t":3,"progress":0}'
}
function Read-Host {
    $global:VaultRecoveryTestPromptCount++
    ConvertTo-SecureString -String $global:VaultRecoveryTestDummyKey -AsPlainText -Force
}
function Start-Process {
    param($FilePath, $ArgumentList, $WindowStyle)
    $global:VaultRecoveryTestWindowArguments = $ArgumentList
    $global:VaultRecoveryTestWindowStyle = $WindowStyle
}

foreach ($path in @($unseal, $show)) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    Assert-True ($errors.Count -eq 0) "PowerShell syntax error: $path"
}

# The test file itself is an existing, harmless IdentityFile for parameter validation.
& $unseal -IdentityFile $PSCommandPath
Assert-True ($global:VaultRecoveryTestPromptCount -eq 0 -and $global:VaultRecoveryTestPostCount -eq 0) 'Open Vault must not prompt or post.'
$global:VaultRecoveryTestScenario = 'closed'
& $unseal -IdentityFile $PSCommandPath
Assert-True ($global:VaultRecoveryTestPromptCount -eq 1 -and $global:VaultRecoveryTestPostCount -eq 1) 'Closed Vault must prompt once and post once.'
Assert-True ($global:VaultRecoveryTestCapturedPayload.key -eq $global:VaultRecoveryTestDummyKey) 'The masked key was not transmitted on stdin.'
$global:VaultRecoveryTestScenario = 'partial'
& $unseal -IdentityFile $PSCommandPath
Assert-True ($global:VaultRecoveryTestPostCount -eq 2) 'Partial unseal must not retry or reset progress.'
$global:VaultRecoveryTestScenario = 'failure'
$failed = $false
try { & $unseal -IdentityFile $PSCommandPath } catch { $failed = $true }
Assert-True $failed 'Remote failure must not be reported as successful unseal.'
& $show -IdentityFile $PSCommandPath
Assert-True ($global:VaultRecoveryTestWindowStyle -eq 'Normal') 'Recovery key must be shown in a visible separate window.'
Assert-True ($global:VaultRecoveryTestWindowArguments -match '-DisplayInCurrentWindow') 'Separate-window mode missing.'
Assert-True (-not $global:VaultRecoveryTestWindowArguments.Contains($global:VaultRecoveryTestDummyKey)) 'A key must never be placed in process arguments.'
Write-Output 'VAULT-WINDOWS-TESTS=OK (syntax, no-op, masked input, partial threshold, SSH failure, separate window)'
