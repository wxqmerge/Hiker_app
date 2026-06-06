param(
    [Parameter(Mandatory=$true)]
    [string]$FrontendUrl,
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl,
    [Parameter(Mandatory=$false)]
    [string]$ApiKey
)

$FrontendUrl = $FrontendUrl.TrimEnd('/')
$ApiUrl = if ($ApiUrl) { $ApiUrl.TrimEnd('/') } else {
    # Auto-detect API domain from frontend URL subpath
    $match = $FrontendUrl -match 'https://[^/]+/(sothh-[a-z]+)'
    if ($match) { "https://$($matches[1]).example.com" }
    else { $FrontendUrl }
}
$ErrorActionPreference = 'Stop'


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

function Test-WriteEndpoint {
    param(
        [string]$Base,
        [string]$Path,
        [string]$Label,
        [string]$Method = "PUT",
        [int]$ExpectedStatusNoAuth = 401,
        [int]$ExpectedStatusWithAuth = 200
    )
    try {
        # Test without API key - should return 401
        $Url = $Base + $Path
        $Result = & curl.exe -s -o NUL -w "%{http_code}" -k --max-time 5 -X $Method -H "Content-Type: application/json" -d '{}' $Url | Out-String
        $Code = [int]$Result.Trim()
        if ($Code -eq $ExpectedStatusNoAuth) {
            Write-Host "PASS $Label - Auth enforced (HTTP $Code)" -ForegroundColor Green
        } else {
            Write-Host "FAIL $Label - Auth not enforced: HTTP $Code (expected $ExpectedStatusNoAuth)" -ForegroundColor Red
            $script:Errors++
        }
    } catch {
        Write-Host "FAIL $Label (no auth) - $_" -ForegroundColor Red
        $script:Errors++
    }

    # Test with API key if provided
    if ($ApiKey) {
        try {
            $Result = & curl.exe -s -o NUL -w "%{http_code}" -k --max-time 5 -X $Method -H "Content-Type: application/json" -H "X-API-Key: $ApiKey" -d '{}' $Url | Out-String
            $Code = [int]$Result.Trim()
            if ($Code -eq $ExpectedStatusWithAuth -or $Code -eq 400) {
                Write-Host "PASS $Label - Auth works (HTTP $Code)" -ForegroundColor Green
            } else {
                Write-Host "WARN $Label - Auth OK but got HTTP $Code (expected $ExpectedStatusWithAuth or 400)" -ForegroundColor Yellow
                $script:Warnings++
            }
        } catch {
            Write-Host "WARN $Label (with auth) - $_" -ForegroundColor Yellow
            $script:Warnings++
        }
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
Write-Host "=== API Key:          $(if ($ApiKey) { '(provided)' } else { '(not provided - write tests skipped)' })"
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
Test-WriteEndpoint -Base $ApiUrl -Path "/api/schedule" -Label "PUT /api/schedule" -Method "PUT" -ExpectedStatusNoAuth 401 -ExpectedStatusWithAuth 200
Test-WriteEndpoint -Base $ApiUrl -Path "/api/schedule/import-trails-xls" -Label "POST /api/schedule/import-trails-xls" -Method "POST" -ExpectedStatusNoAuth 401 -ExpectedStatusWithAuth 400
Test-WriteEndpoint -Base $ApiUrl -Path "/api/schedule/import-xls" -Label "POST /api/schedule/import-xls" -Method "POST" -ExpectedStatusNoAuth 401 -ExpectedStatusWithAuth 400
Test-Endpoint -Base $ApiUrl -Path "/api/schedule/report?quarter=Q1" -Label "GET /api/schedule/report" -ExpectedStatus 200
Test-Endpoint -Base $ApiUrl -Path "/api/schedule/download?quarter=Q1" -Label "GET /api/schedule/download" -ExpectedStatus 200

Write-Host ""
Write-Host "--- SPA Routing ---"
Test-Endpoint -Base $FrontendUrl -Path "/trail/360_Rd" -Label "Trail detail page" -ExpectedStatus 200
Test-Endpoint -Base $FrontendUrl -Path "/trails" -Label "Trail manager page" -ExpectedStatus 200
Test-Endpoint -Base $FrontendUrl -Path "/schedule" -Label "Schedule builder page" -ExpectedStatus 200

Write-Host ""
Write-Host "--- API via Frontend (nginx proxy) ---"
$subpath = ($FrontendUrl -replace 'https://[^/]+', '') -replace '/$', ''
Test-Endpoint -Base $FrontendUrl -Path "$subpath/api/trails" -Label "GET /api/trails via frontend" -ExpectedStatus 200
Test-Endpoint -Base $FrontendUrl -Path "$subpath/api/schedule" -Label "GET /api/schedule via frontend" -ExpectedStatus 200

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
