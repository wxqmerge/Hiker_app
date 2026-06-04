param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

$Url = $Url.TrimEnd('/')
$ErrorActionPreference = 'Stop'

$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$NC = "`e[0m"

$Errors = 0
$Warnings = 0

function Test-Endpoint {
    param(
        [string]$Path,
        [string]$Label,
        [int]$ExpectedStatus = 200
    )
    try {
        $Response = Invoke-WebRequest -Uri "$Url$Path" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($Response.StatusCode -eq $ExpectedStatus) {
            Write-Host "$GREEN`e[1m✓$NC $Label - HTTP $($Response.StatusCode)"
        } else {
            Write-Host "$RED`e[1m✗$NC $Label - HTTP $($Response.StatusCode) (expected $ExpectedStatus)"
            $script:Errors++
        }
    } catch {
        $Status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "ERROR" }
        Write-Host "$RED`e[1m✗$NC $Label - $Status"
        $script:Errors++
    }
}

function Test-ApiJson {
    param(
        [string]$Path,
        [string]$Label,
        [string]$ExpectedKey
    )
    try {
        $Response = Invoke-WebRequest -Uri "$Url$Path" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        $Body = $Response.Content | ConvertFrom-Json
        if ($ExpectedKey -and $Body.PSObject.Properties.Name -contains $ExpectedKey) {
            $Count = if ($Body.$ExpectedKey -is [array]) { $Body.$ExpectedKey.Count } elseif ($Body.$ExpectedKey -is [hashtable]) { $Body.$ExpectedKey.Count } else { 1 }
            Write-Host "$GREEN`e[1m✓$NC $Label - $Count items"
        } else {
            Write-Host "$GREEN`e[1m✓$NC $Label - HTTP $($Response.StatusCode)"
        }
    } catch {
        $Status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "ERROR" }
        Write-Host "$RED`e[1m✗$NC $Label - $Status"
        $script:Errors++
    }
}

Write-Host "`n=== Testing $Url ==="
Write-Host ""

Write-Host "--- Frontend ---"
Test-Endpoint -Path "/" -Label "Frontend (index.html)" -ExpectedStatus 200
Test-Endpoint -Path "/assets/" -Label "Static assets" -ExpectedStatus 200

Write-Host ""
Write-Host "--- Server ---"
Test-Endpoint -Path "/health" -Label "Health check" -ExpectedStatus 200

Write-Host ""
Write-Host "--- API ---"
Test-ApiJson -Path "/api/trails" -Label "GET /api/trails" -ExpectedKey "trails"
Test-ApiJson -Path "/api/trails/details" -Label "GET /api/trails/details" -ExpectedKey ""
Test-ApiJson -Path "/api/lookup" -Label "GET /api/lookup" -ExpectedKey "difficulties"
Test-ApiJson -Path "/api/schedule" -Label "GET /api/schedule" -ExpectedKey ""

Write-Host ""
Write-Host "--- SPA Routing ---"
Test-Endpoint -Path "/trail/360_Rd" -Label "Trail detail page" -ExpectedStatus 200
Test-Endpoint -Path "/trails" -Label "Trail manager page" -ExpectedStatus 200
Test-Endpoint -Path "/schedule" -Label "Schedule builder page" -ExpectedStatus 200

Write-Host ""
Write-Host "=== Summary ==="
if ($Errors -eq 0 -and $Warnings -eq 0) {
    Write-Host "$GREEN All checks passed.$NC"
} elseif ($Errors -eq 0) {
    Write-Host "$YELLOW No errors, $Warnings warning(s).$NC"
} else {
    Write-Host "$RED $Errors error(s), $Warnings warning(s).$NC"
}

exit $Errors
