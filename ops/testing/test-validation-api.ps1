[CmdletBinding()]
param(
    [string]$BaseUri = 'http://127.0.0.1:8088',
    [string]$ValidationPassword = 'password',
    [ValidateSet('iceforge_validation', 'iceforge_staging')]
    [string]$ProjectName = 'iceforge_validation',
    [string]$DockerPath
)

$ErrorActionPreference = 'Stop'
$projectName = $ProjectName
$BaseUri = $BaseUri.TrimEnd('/')

function Resolve-DockerExecutable {
    if ($DockerPath) {
        if (-not (Test-Path -LiteralPath $DockerPath -PathType Leaf)) {
            throw "Docker introuvable au chemin fourni."
        }
        return (Resolve-Path -LiteralPath $DockerPath).Path
    }

    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $perUserDocker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
    if (Test-Path -LiteralPath $perUserDocker -PathType Leaf) { return $perUserDocker }

    throw "Docker est introuvable. Ajoutez-le au PATH ou utilisez -DockerPath."
}

function Invoke-Docker {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & $script:DockerExecutable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "La verification Docker a echoue (code $LASTEXITCODE)."
    }
    return @($output | ForEach-Object { $_.ToString() })
}

function Assert-ValidationTarget {
    $uri = [Uri]$BaseUri
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'http' -or
        $uri.Host -notin @('127.0.0.1', 'localhost', '::1')) {
        throw "Refus: BaseUri doit etre une adresse HTTP locale (localhost/loopback)."
    }
    if ($uri.AbsolutePath -ne '/') {
        throw "Refus: BaseUri ne doit pas contenir de chemin."
    }

    if ($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -ne $projectName) {
        throw "Refus: COMPOSE_PROJECT_NAME doit etre $projectName."
    }

    $serviceIds = @{}
    foreach ($service in @('frontend', 'backend')) {
        $ids = Invoke-Docker @(
            'ps', '-q',
            '--filter', "label=com.docker.compose.project=$projectName",
            '--filter', "label=com.docker.compose.service=$service"
        )
        $ids = @($ids | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($ids.Count -ne 1) {
            throw "Refus: exactement un conteneur $service actif du projet $projectName est requis."
        }

        $state = (Invoke-Docker @(
            'inspect', '--format',
            '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}',
            $ids[0]
        )) -join ''
        $parts = $state.Split('|')
        if ($parts.Count -ne 4 -or $parts[0] -ne 'running' -or
            $parts[2] -ne $projectName -or $parts[3] -ne $service) {
            throw "Refus: le conteneur $service n'appartient pas a la pile active $projectName."
        }
        if ($parts[1] -notin @('healthy', 'none')) {
            throw "Refus: le service $service de validation n'est pas sain."
        }
        $serviceIds[$service] = $ids[0]
    }

    $publishedPorts = (Invoke-Docker @('port', $serviceIds.frontend)) -join "`n"
    $targetPort = if ($uri.IsDefaultPort) { 80 } else { $uri.Port }
    if ($publishedPorts -notmatch ":$targetPort(?:\s|$)") {
        throw "Refus: le port $targetPort de BaseUri n'est pas publie par le frontend de validation."
    }
}

function Invoke-ApiRequest {
    param(
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [string]$Token,
        [AllowNull()][object]$Body,
        [switch]$NoRedirect
    )

    $headers = @{}
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $parameters = @{
        Uri               = "$BaseUri$Path"
        Method            = $Method
        Headers           = $headers
        SkipHttpErrorCheck = $true
        TimeoutSec        = 20
    }
    if ($PSBoundParameters.ContainsKey('Body')) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    }
    if ($NoRedirect) {
        # Invoke-WebRequest returns the 3xx response but also emits a non-
        # terminating redirect-limit error when MaximumRedirection is zero.
        $parameters.MaximumRedirection = 0
        $parameters.ErrorAction = 'SilentlyContinue'
    }

    try {
        return Invoke-WebRequest @parameters
    } catch {
        throw "Requete API impossible pour $Method $Path."
    }
}

function Add-CheckResult {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Actor,
        [Parameter(Mandatory)][int]$Actual,
        [Parameter(Mandatory)][int[]]$Expected
    )
    $passed = $Expected -contains $Actual
    $script:Results.Add([pscustomobject]@{
        Check = $Id
        Acteur = $Actor
        Statut = $Actual
        Attendu = $Expected -join '/'
        Resultat = if ($passed) { 'OK' } else { 'ECHEC' }
    })
}

function Add-ResponseCheckResult {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][object]$Response,
        [Parameter(Mandatory)][int[]]$ExpectedStatus,
        [string]$HeaderName,
        [string]$HeaderPattern
    )
    $actual = [int]$Response.StatusCode
    $passed = $ExpectedStatus -contains $actual
    if ($passed -and $HeaderName) {
        $headerValue = [string]($Response.Headers[$HeaderName] -join ', ')
        $passed = $headerValue -match $HeaderPattern
    }
    $script:Results.Add([pscustomobject]@{
        Check = $Id
        Acteur = 'RUNTIME'
        Statut = $actual
        Attendu = if ($HeaderName) { "$($ExpectedStatus -join '/') + $HeaderName" } else { $ExpectedStatus -join '/' }
        Resultat = if ($passed) { 'OK' } else { 'ECHEC' }
    })
}

$script:DockerExecutable = Resolve-DockerExecutable
Assert-ValidationTarget

$script:Results = [System.Collections.Generic.List[object]]::new()
$tokens = @{}
$accounts = @(
    @{ Actor = 'USER'; Username = 'validation_user'; ExpectedRole = 'USER' },
    @{ Actor = 'OFFICIER'; Username = 'validation_officier'; ExpectedRole = 'OFFICIER' },
    @{ Actor = 'ADMIN'; Username = 'validation_admin'; ExpectedRole = 'ADMIN' }
)

foreach ($account in $accounts) {
    $response = Invoke-ApiRequest -Method POST -Path '/api/auth/login' -Body @{
        username = $account.Username
        password = $ValidationPassword
    }
    Add-CheckResult -Id "AUTH-$($account.Actor)" -Actor $account.Actor -Actual $response.StatusCode -Expected @(200)
    if ($response.StatusCode -ne 200) { continue }

    try { $login = $response.Content | ConvertFrom-Json } catch { throw "Reponse de login JSON invalide pour $($account.Actor)." }
    $accessToken = $login.tokens.accessToken
    $roles = @($login.user.roles)
    if ([string]::IsNullOrWhiteSpace($accessToken)) { throw "Login sans access token pour $($account.Actor)." }
    if ($roles -notcontains $account.ExpectedRole) { throw "Role inattendu pour $($account.Actor)." }
    $tokens[$account.Actor] = $accessToken
}

$checks = @(
    @{ Id='PUB-MEMBERS'; Actor='ANONYME'; Method='GET'; Path='/api/front/members'; Expected=@(200) },
    @{ Id='PUB-SHIPS'; Actor='ANONYME'; Method='GET'; Path='/api/ships'; Expected=@(200) },
    @{ Id='ANON-PROFILE'; Actor='ANONYME'; Method='GET'; Path='/api/users/me/profile'; Expected=@(401,403) },
    @{ Id='MEMBER-FLEET-ANON-DENY'; Actor='ANONYME'; Method='GET'; Path='/api/user-ships/member?eventId=14000000-0000-0000-0000-000000000001&userId=10000000-0000-0000-0000-000000000001'; Expected=@(401,403) },

    @{ Id='PROFILE-USER'; Actor='USER'; Method='GET'; Path='/api/users/me/profile'; Expected=@(200) },
    @{ Id='MEMBER-FLEET-USER'; Actor='USER'; Method='GET'; Path='/api/user-ships/member?eventId=14000000-0000-0000-0000-000000000001&userId=10000000-0000-0000-0000-000000000001'; Expected=@(200) },
    @{ Id='MEMBER-FLEET-UNRELATED-DENY'; Actor='USER'; Method='GET'; Path='/api/user-ships/member?eventId=14000000-0000-0000-0000-000000000001&userId=10000000-0000-0000-0000-000000000003'; Expected=@(403) },
    @{ Id='PROFILE-OFFICIER'; Actor='OFFICIER'; Method='GET'; Path='/api/users/me/profile'; Expected=@(200) },
    @{ Id='PROFILE-ADMIN'; Actor='ADMIN'; Method='GET'; Path='/api/users/me/profile'; Expected=@(200) },

    @{ Id='USERS-USER-DENY'; Actor='USER'; Method='GET'; Path='/api/users/all'; Expected=@(403) },
    @{ Id='USERS-OFFICIER'; Actor='OFFICIER'; Method='GET'; Path='/api/users/all'; Expected=@(200) },
    @{ Id='USERS-ADMIN'; Actor='ADMIN'; Method='GET'; Path='/api/users/all'; Expected=@(200) },

    @{ Id='MINING-LOC-USER-DENY'; Actor='USER'; Method='GET'; Path='/api/mining-sheets/sale-locations'; Expected=@(403) },
    @{ Id='MINING-LOC-OFFICIER-DENY'; Actor='OFFICIER'; Method='GET'; Path='/api/mining-sheets/sale-locations'; Expected=@(403) },
    @{ Id='MINING-LOC-ADMIN'; Actor='ADMIN'; Method='GET'; Path='/api/mining-sheets/sale-locations'; Expected=@(200) },

    @{ Id='ITEM-CREATE-USER-DENY'; Actor='USER'; Method='POST'; Path='/api/admin/items'; Body=@{}; Expected=@(403) },
    @{ Id='ITEM-CREATE-OFFICIER-INVALID'; Actor='OFFICIER'; Method='POST'; Path='/api/admin/items'; Body=@{}; Expected=@(400) },
    @{ Id='ITEM-CREATE-ADMIN-INVALID'; Actor='ADMIN'; Method='POST'; Path='/api/admin/items'; Body=@{}; Expected=@(400) },

    @{ Id='SCWE-CREATE-USER-DENY'; Actor='USER'; Method='POST'; Path='/api/sc-world-events'; Body=@{}; Expected=@(403) },
    @{ Id='SCWE-CREATE-OFFICIER-DENY'; Actor='OFFICIER'; Method='POST'; Path='/api/sc-world-events'; Body=@{}; Expected=@(403) },
    @{ Id='SCWE-CREATE-ADMIN-INVALID'; Actor='ADMIN'; Method='POST'; Path='/api/sc-world-events'; Body=@{}; Expected=@(400) },

    @{ Id='MINING-CREATE-USER-DENY'; Actor='USER'; Method='POST'; Path='/api/mining-sheets'; Body=@{}; Expected=@(403) },
    @{ Id='MINING-CREATE-OFFICIER-DENY'; Actor='OFFICIER'; Method='POST'; Path='/api/mining-sheets'; Body=@{}; Expected=@(403) },
    @{ Id='MINING-CREATE-ADMIN-INVALID'; Actor='ADMIN'; Method='POST'; Path='/api/mining-sheets'; Body=@{}; Expected=@(400) }
)

foreach ($check in $checks) {
    $token = if ($check.Actor -eq 'ANONYME') { $null } else { $tokens[$check.Actor] }
    if ($check.Actor -ne 'ANONYME' -and [string]::IsNullOrWhiteSpace($token)) {
        Add-CheckResult -Id $check.Id -Actor $check.Actor -Actual 0 -Expected $check.Expected
        continue
    }

    $request = @{
        Method = $check.Method
        Path = $check.Path
        Token = $token
    }
    if ($check.ContainsKey('Body')) { $request.Body = $check.Body }
    $response = Invoke-ApiRequest @request
    Add-CheckResult -Id $check.Id -Actor $check.Actor -Actual $response.StatusCode -Expected $check.Expected
}

# Runtime frontend checks are derived from the same route policy as SSR, so a
# newly declared route automatically becomes part of this non-destructive run.
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$routePolicyPath = Join-Path $repositoryRoot 'icy-angular\src\app\app-route-policy.ts'
$routePolicy = Get-Content -Raw -LiteralPath $routePolicyPath
$knownBlock = [regex]::Match($routePolicy, '(?s)const knownRoutes = new Set\(\[(.*?)\]\);')
$redirectBlock = [regex]::Match($routePolicy, '(?s)const canonicalRedirects = new Map<string, string>\(\[(.*?)\]\);')
if (-not $knownBlock.Success -or -not $redirectBlock.Success) {
    throw "Impossible de lire la politique de routes frontend."
}

$knownRoutes = @([regex]::Matches($knownBlock.Groups[1].Value, "'([^']+)'") |
    ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
$privateRoutes = @(
    '/login',
    '/utilitaires/collection',
    '/utilitaires/executive-hangar-players',
    '/utilitaires/fiches-minage'
)

foreach ($path in $knownRoutes) {
    $response = Invoke-ApiRequest -Method GET -Path $path
    $routeName = $path.Replace('/', '-').Trim('-').ToUpper()
    if (-not $routeName) { $routeName = 'HOME' }
    $isPrivate = $path -eq '/icy' -or $path.StartsWith('/icy/') -or $privateRoutes -contains $path
    if ($isPrivate) {
        Add-ResponseCheckResult -Id "SPA-$routeName" -Response $response -ExpectedStatus @(200) -HeaderName 'Cache-Control' -HeaderPattern 'no-store'
    } else {
        Add-ResponseCheckResult -Id "SPA-$routeName" -Response $response -ExpectedStatus @(200)
    }
}

$redirects = [regex]::Matches($redirectBlock.Groups[1].Value, "\['([^']+)',\s*'([^']+)'\]")
foreach ($redirect in $redirects) {
    $source = $redirect.Groups[1].Value
    $destination = $redirect.Groups[2].Value
    $response = Invoke-ApiRequest -Method GET -Path "$source`?source=validation" -NoRedirect
    $redirectName = $source.Replace('/', '-').Trim('-').ToUpper()
    Add-ResponseCheckResult -Id "SPA-308-$redirectName" -Response $response -ExpectedStatus @(308) -HeaderName 'Location' -HeaderPattern "^$([regex]::Escape($destination))\?source=validation$"
}

$response = Invoke-ApiRequest -Method GET -Path '/ngsw.json'
Add-ResponseCheckResult -Id 'PWA-MANIFEST-NOCACHE' -Response $response -ExpectedStatus @(200) -HeaderName 'Cache-Control' -HeaderPattern 'no-cache'

$response = Invoke-ApiRequest -Method GET -Path '/api/front/members'
Add-ResponseCheckResult -Id 'API-NOSTORE' -Response $response -ExpectedStatus @(200) -HeaderName 'Cache-Control' -HeaderPattern 'no-store'

# Known static-runtime gap: unlike the SSR server, Nginx must keep the SPA
# fallback at 200 to avoid breaking routes that are added without a matching
# Nginx rule. This check makes that difference explicit and regression-visible.
$response = Invoke-ApiRequest -Method GET -Path '/__validation_unknown_route__'
Add-ResponseCheckResult -Id 'SPA-UNKNOWN-404' -Response $response -ExpectedStatus @(404)

$Results | Format-Table -AutoSize
$failures = @($Results | Where-Object Resultat -eq 'ECHEC')
Write-Host "`nBilan: $($Results.Count - $failures.Count)/$($Results.Count) checks OK. Aucun jeton n'a ete affiche."
if ($failures.Count -gt 0) { exit 1 }
