param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

$Url = $Url.TrimEnd('/')
$ErrorActionPreference = 'Stop'

Clear-Host
$Errors = 0
$Warnings = 0

function Test-Endpoint {
    param(
        [string]$Path,
        [string]$Label,
        [int]$ExpectedStatus = 200
    )
    try {
        $Output = & curl.exe -s -o NUL -w "%{http_code}" -k --max-time 10 ($Url + $Path) | Out-String
        $Code = [int]($Output.Trim())
        if ($Code -eq $ExpectedStatus) {
            Write-Host "PASS $Label - HTTP $Code" -ForegroundColor Green
        } else {
            Write-Host "FAIL $Label - HTTP $Code (expected $ExpectedStatus)" -ForegroundColor Red
            $script:Errors++
        }
    } catch {
        Write-Host "FAIL $Label - $_" -ForegroundColor Red
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
        $CodeOutput = & curl.exe -s -o NUL -w "%{http_code}" -k --max-time 10 ($Url + $Path) | Out-String
        $Code = [int]($CodeOutput.Trim())
        if ($Code -eq 200) {
            $Body = (& curl.exe -s -k --max-time 10 ($Url + $Path)) | ConvertFrom-Json
            if ($ExpectedKey -and $Body.PSObject.Properties.Name -contains $ExpectedKey) {
                $Count = if ($Body.$ExpectedKey -is [array]) { $Body.$ExpectedKey.Count } elseif ($Body.$ExpectedKey -is [hashtable]) { $Body.$ExpectedKey.Count } else { 1 }
                Write-Host "PASS $Label - $Count items" -ForegroundColor Green
            } else {
                Write-Host "PASS $Label - HTTP 200" -ForegroundColor Green
            }
        } else {
            Write-Host "FAIL $Label - HTTP $Code" -ForegroundColor Red
            $script:Errors++
        }
    } catch {
        Write-Host "FAIL $Label - $_" -ForegroundColor Red
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
    Write-Host "All checks passed." -ForegroundColor Green
} elseif ($Errors -eq 0) {
    Write-Host "No errors, $Warnings warning(s)." -ForegroundColor Yellow
} else {
    Write-Host "$Errors error(s), $Warnings warning(s)." -ForegroundColor Red
}

exit $Errors
