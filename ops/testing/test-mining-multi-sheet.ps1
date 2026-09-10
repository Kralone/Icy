param([string]$BaseUrl = 'http://127.0.0.1:18088')
$ErrorActionPreference = 'Stop'
if ($BaseUrl -notmatch '^http://(127\.0\.0\.1|localhost):\d+$') { throw 'Test réservé à la base locale.' }
$login = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"validation_admin","password":"password"}'
$headers = @{ Authorization = 'Bearer ' + $login.tokens.accessToken }
function Call-Api($path, $body, $auth = $headers) {
    $r = Invoke-RestMethod "$BaseUrl/api/mining-sheets$path" -Headers $auth -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8 -Compress)
    if ($r.PSObject.Properties.Name -contains 'data') { return $r.data }
    return $r
}
$users = (Invoke-RestMethod "$BaseUrl/api/users/all" -Headers $headers).data
$admin = ($users | Where-Object username -eq 'validation_admin').id
$member = ($users | Where-Object username -eq 'validation_user').id
if (!$admin -or !$member) { throw 'Comptes de validation absents.' }
$memberLogin = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"validation_user","password":"password"}'
$memberHeaders = @{ Authorization = 'Bearer ' + $memberLogin.tokens.accessToken }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$results = @()
foreach ($case in @(@{ label='A'; sale=600000; adminCost=12000; memberCost=6000 }, @{ label='B'; sale=300000; adminCost=3000; memberCost=9000 })) {
    $sheet = Call-Api '' @{ sheetName="DÉMO QA $stamp - Vente groupée $($case.label)"; operationDate=(Get-Date -Format 'yyyy-MM-dd'); refineryLocation='ARC-L1'; saleLocation='Area18'; memberIds=@($admin,$member) }
    foreach ($owner in @($admin,$member)) {
        $ownerHeaders = if ($owner -eq $admin) { $headers } else { $memberHeaders }
        $sheet = Call-Api "/$($sheet.id)/jobs" @{ type='REFINERY'; ownerUserId=$owner; costAuec=0; durationMinutes=0; ores=@(@{oreName='Quantanium';quantityCscu=10000;includeInSale=$true}) } $ownerHeaders
    }
    $sheet = Call-Api "/$($sheet.id)/jobs" @{type='FUEL';ownerUserId=$admin;costAuec=$case.adminCost}
    $sheet = Call-Api "/$($sheet.id)/jobs" @{type='MATERIAL';ownerUserId=$member;costAuec=$case.memberCost} $memberHeaders
    $sheet = Call-Api "/$($sheet.id)/sales" @{creditAuec=$case.sale}
    $rows = $sheet.summary.saleSettlements
    $a = $rows | Where-Object userId -eq $admin
    $b = $rows | Where-Object userId -eq $member
    $halfCosts = ($case.adminCost + $case.memberCost) / 2
    if ($a.payoutAuec -ne ($case.sale / 2 + $case.adminCost - $halfCosts)) { throw 'Remboursement admin incorrect.' }
    if ($b.payoutAuec -ne ($case.sale / 2 + $case.memberCost - $halfCosts)) { throw 'Remboursement participant incorrect.' }
    if (($rows | Measure-Object payoutAuec -Sum).Sum -ne $case.sale) { throw 'Somme répartie différente de la vente.' }
    if ($sheet.status -ne 'OPEN') { throw "Vente a changé statut : $($sheet.status)" }
    $transfers = @($sheet.summary.saleTransfers)
    if ($transfers.Count -ne 1 -or $transfers[0].fromUserId -ne $admin -or $transfers[0].toUserId -ne $member -or $transfers[0].amountAuec -ne $b.payoutAuec) { throw 'Virement final incorrect.' }
    $results += [ordered]@{ sheetId=$sheet.id; sale=$case.sale; adminPayout=$a.payoutAuec; memberPayout=$b.payoutAuec; status=$sheet.status }
}
$results | ConvertTo-Json
Write-Output 'PASS : deux fiches, vente totale 900000 aUEC, avances des deux participants remboursées et fiches ouvertes.'
