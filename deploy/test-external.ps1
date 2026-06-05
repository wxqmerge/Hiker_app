param(
    [Parameter(Mandatory=$true)]
    [string]$FrontendUrl,
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl
)

$FrontendUrl = $FrontendUrl.TrimEnd('/')
$ApiUrl = if ($ApiUrl) { $ApiUrl.TrimEnd('/') } else { $FrontendUrl }
$ErrorActionPreference = 'Stop'

Clear-Host
$Errors = 0
$Warnings = 0

function Test-Endpoint {
    param(
        [string]$Base,
        [string]$Path,
        [string]$Label,
        [int]$ExpectedStatus = 200
    )
    try {
        $Url = $Base + $Path
        $Result = & curl.exe -s -o NUL -w "%{http_code},%{time_total}" -k --max-time 5 $Url | Out-String
        $Parts = $Result.Trim().Split(',')
        $Code = [int]$Parts[0]
        $Latency = [float]$Parts[1]
        
        if ($Code -eq $ExpectedStatus) {
            Write-Host "PASS $Label - HTTP $Code ($($Latency.ToString('F3'))s)" -ForegroundColor Green
        } else {
            Write-Host "FAIL $Label - HTTP $Code (expected $ExpectedStatus, latency: $($Latency.ToString('F3'))s)" -ForegroundColor Red
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
        $Url = $ApiUrl + $Path
        $Result = & curl.exe -s -o NUL -w "%{http_code},%{time_total}" -k --max-time 5 $Url | Out-String
        $Parts = $Result.Trim().Split(',')
        $Code = [int]$Parts[0]
        $Latency = [float]$Parts[1]

        if ($Code -eq 200) {
            if ($ExpectedKey) {
                $RawBody = (& curl.exe -s -k --max-time 5 $Url)
                if ([string]::IsNullOrWhiteSpace($RawBody)) {
                    Write-Host "FAIL $Label - HTTP 200 but empty body" -ForegroundColor Red
                    $script:Errors++
                } else {
                    try {
                        $Body = $RawBody | ConvertFrom-Json
                        if ($Body.PSObject.Properties.Name -contains $ExpectedKey) {
                            $val = $Body.$ExpectedKey
                            $Count = if ($val -is [array]) { $val.Count } elseif ($val -is [hashtable]) { $val.Count } else { 1 }
                            Write-Host "PASS $Label - $Count items ($($Latency.ToString('F3'))s)" -ForegroundColor Green
                        } else {
                            Write-Host "PASS $Label - HTTP 200 ($($Latency.ToString('F3'))s)" -ForegroundColor Green
                        }
                    } catch {
                        Write-Host "FAIL $Label - Invalid JSON response: $_" -ForegroundColor Red
                        $script:Errors++
                    }
                }
            } else {
                Write-Host "PASS $Label - HTTP 200 ($($Latency.ToString('F3'))s)" -ForegroundColor Green
            }
        } else {
            Write-Host "FAIL $Label - HTTP $Code (expected 200, latency: $($Latency.ToString('F3'))s)" -ForegroundColor Red
            $script:Errors++
        }
    } catch {
        Write-Host "FAIL $Label - $_" -ForegroundColor Red
        $script:Errors++
    }
}

function Test-FrontendContent {
    param(
        [string]$Base,
        [string]$Path,
        [string]$Label,
        [string]$ExpectedSelector
    )
    try {
        $Url = $Base + $Path
        $Result = & curl.exe -s -o NUL -w "%{http_code},%{time_total}" -k --max-time 5 $Url | Out-String
        $Parts = $Result.Trim().Split(',')
        $Code = [int]$Parts[0]
        $Latency = [float]$Parts[1]

        if ($Code -eq 200) {
            $Body = (& curl.exe -s -k --max-time 5 $Url) | Out-String
            if ($Body -match $ExpectedSelector) {
                Write-Host "PASS $Label - HTTP 200 (found '$ExpectedSelector', $($Latency.ToString('F3'))s)" -ForegroundColor Green
            } else {
                Write-Host "FAIL $Label - HTTP 200 (missing '$ExpectedSelector', $($Latency.ToString('F3'))s)" -ForegroundColor Red
                $script:Errors++
            }
        } else {
            Write-Host "FAIL $Label - HTTP $Code (expected 200, latency: $($Latency.ToString('F3'))s)" -ForegroundColor Red
            $script:Errors++
        }
    } catch {
        Write-Host "FAIL $Label - $_" -ForegroundColor Red
        $script:Errors++
    }
}

Write-Host "`n=== Testing Frontend: $FrontendUrl ==="
Write-Host "=== Testing API:      $ApiUrl ==="
Write-Host ""

Write-Host "--- Frontend ---"
Test-Endpoint -Base $FrontendUrl -Path "/" -Label "Frontend (index.html)" -ExpectedStatus 200
Test-FrontendContent -Base $FrontendUrl -Path "/" -Label "Frontend (index.html) content" -ExpectedSelector '<div id="root">'
Test-Endpoint -Base $FrontendUrl -Path "/favicon.svg" -Label "Static assets" -ExpectedStatus 200

Write-Host ""
Write-Host "--- Server ---"
Test-Endpoint -Base $ApiUrl -Path "/health" -Label "Health check" -ExpectedStatus 200

Write-Host ""
Write-Host "--- API ---"
Test-ApiJson -Path "/api/trails" -Label "GET /api/trails" -ExpectedKey "trails"
Test-ApiJson -Path "/api/trails/details" -Label "GET /api/trails/details" -ExpectedKey ""
Test-ApiJson -Path "/api/lookup" -Label "GET /api/lookup" -ExpectedKey ""
Test-ApiJson -Path "/api/schedule" -Label "GET /api/schedule" -ExpectedKey ""
Test-Endpoint -Base $ApiUrl -Path "/api/schedule/report?quarter=Q1" -Label "GET /api/schedule/report" -ExpectedStatus 200
Test-Endpoint -Base $ApiUrl -Path "/api/schedule/download?quarter=Q1" -Label "GET /api/schedule/download" -ExpectedStatus 200

Write-Host ""
Write-Host "--- SPA Routing ---"
Test-Endpoint -Base $FrontendUrl -Path "/trail/360_Rd" -Label "Trail detail page" -ExpectedStatus 200
Test-Endpoint -Base $FrontendUrl -Path "/trails" -Label "Trail manager page" -ExpectedStatus 200
Test-Endpoint -Base $FrontendUrl -Path "/schedule" -Label "Schedule builder page" -ExpectedStatus 200

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
