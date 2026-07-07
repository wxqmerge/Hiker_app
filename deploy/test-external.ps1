# NOTE: FrontendUrl must be the subpath form (https://main-domain/<subpath>/),
# NOT the subdomain form (https://<subdomain>.main-domain/).
# Nginx serves the app at a path, not at a subdomain root.
#
# Usage:
#   .\test-external.ps1 -FrontendUrl "https://example.com/sothh-dev"
#   .\test-external.ps1 -FrontendUrl "https://example.com/sothh-dev" -ApiKey "your-key"
#   .\test-external.ps1 -FrontendUrl "https://example.com/sothh-dev" -ApiUrl "https://sothh-dev.example.com" -ApiKey "your-key"
#
# Parameters:
#   FrontendUrl  (required)  Frontend URL with subpath, e.g. https://example.com/sothh-dev
#   ApiUrl       (optional)  API server URL, auto-detected from FrontendUrl if omitted
#   ApiKey       (optional)  API key for write endpoint auth tests; without it, write tests only check 401
param(
    [Parameter(Mandatory=$true, HelpMessage="Frontend URL with subpath, e.g. https://example.com/sothh-dev")]
    [string]$FrontendUrl,
    [Parameter(Mandatory=$false, HelpMessage="API server URL (auto-detected if omitted)")]
    [string]$ApiUrl,
    [Parameter(Mandatory=$false, HelpMessage="API key for write endpoint auth tests")]
    [string]$ApiKey
)

$FrontendUrl = $FrontendUrl.TrimEnd('/')
$ApiUrl = if ($ApiUrl) { $ApiUrl.TrimEnd('/') } else {
    # Auto-detect API domain from frontend URL subpath
    $match = $FrontendUrl -match 'https://[^/]+/(sothh-[\w-]+)'
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
Write-Host "--- GPX Endpoints ---"
# Test GPX endpoint for a known trail that should have GPX
$GpxTestTrail = "oat"
$GpxResult = & curl.exe -s -o NUL -w "%{http_code},%{size_download}" -k --max-time 5 "$ApiUrl/api/trails/gpx/$GpxTestTrail" | Out-String
$GpxParts = $GpxResult.Trim().Split(',')
$GpxCode = [int]$GpxParts[0]
$GpxSize = if ($GpxParts.Count -gt 1) { [int]$GpxParts[1] } else { 0 }
if ($GpxCode -eq 200 -and $GpxSize -gt 0) {
    Write-Host "PASS GPX endpoint ($GpxTestTrail) - HTTP $GpxCode ($($GpxSize) bytes)" -ForegroundColor Green
} else {
    Write-Host "FAIL GPX endpoint ($GpxTestTrail) - HTTP $GpxCode ($($GpxSize) bytes) - GPX files may be missing on server" -ForegroundColor Red
    $script:Errors++
}

Write-Host ""
Write-Host "--- Data Summary (compare with localhost) ---"
# Fetch trails data
$TrailsRaw = (& curl.exe -s -k --max-time 10 "$ApiUrl/api/trails")
if ($TrailsRaw) {
    $TrailsData = $TrailsRaw | ConvertFrom-Json
    $TrailCount = $TrailsData.trails.Count
    $TrailsWithGpx = ($TrailsData.trails | Where-Object { $_.hasGpx -eq $true }).Count
    $TrailsWithGpxFile = ($TrailsData.trails | Where-Object { $_.gpxFile }).Count
    $OatHorse = $TrailsData.trails | Where-Object { $_.id -eq 'oat-horse-to-living-room' }
    $OatHorseName = if ($OatHorse) { $OatHorse.fullName } else { 'MISSING' }
    $OatHorseGpx = if ($OatHorse) { $OatHorse.gpxFile } else { 'N/A' }
    $OatHorseHasGpx = if ($OatHorse) { $OatHorse.hasGpx } else { 'N/A' }

    Write-Host "  Trails:           $TrailCount (expected ~180+)" -ForegroundColor $(if ($TrailCount -ge 180) { 'Green' } else { 'Yellow' })
    Write-Host "  Trails w/ hasGpx: $TrailsWithGpx"
    Write-Host "  Trails w/ gpxFile: $TrailsWithGpxFile"
    if ($TrailsWithGpx -gt 0 -and $TrailsWithGpxFile -eq 0) {
        Write-Host "  WARNING: hasGpx set but no gpxFile - GPX files not imported" -ForegroundColor Yellow
        $script:Warnings++
    }

    Write-Host ""
    Write-Host "  'OAT - Horse Parking to Living Room':"
    Write-Host "    ID:         $($OatHorse.id)"
    Write-Host "    Name:       $OatHorseName"
    Write-Host "    gpxFile:    $OatHorseGpx"
    Write-Host "    hasGpx:     $OatHorseHasGpx"
    if ($OatHorse -and $OatHorseGpx -and $OatHorseHasGpx) {
        # Test if the actual GPX file is accessible
        $GpxTest2 = & curl.exe -s -o NUL -w "%{http_code},%{size_download}" -k --max-time 5 "$ApiUrl/api/trails/gpx/oat-horse-to-living-room" | Out-String
        $GpxParts2 = $GpxTest2.Trim().Split(',')
        $GpxCode2 = [int]$GpxParts2[0]
        $GpxSize2 = if ($GpxParts2.Count -gt 1) { [int]$GpxParts2[1] } else { 0 }
        Write-Host "    GPX fetch:  HTTP $GpxCode2 ($($GpxSize2) bytes)" -ForegroundColor $(if ($GpxCode2 -eq 200 -and $GpxSize2 -gt 0) { 'Green' } else { 'Red' })
        if ($GpxCode2 -ne 200 -or $GpxSize2 -eq 0) {
            Write-Host "    ! GPX file referenced but not on server disk - re-export/import ZIP" -ForegroundColor Yellow
            $script:Warnings++
        }
    } elseif (-not $OatHorse) {
        Write-Host "    ! Trail not found on server - data not synced from localhost" -ForegroundColor Yellow
        $script:Warnings++
    }
} else {
    Write-Host "  Could not fetch trails data" -ForegroundColor Red
    $script:Errors++
}

# Fetch trail details summary
$DetailsRaw = (& curl.exe -s -k --max-time 10 "$ApiUrl/api/trails/details")
if ($DetailsRaw) {
    $DetailsData = $DetailsRaw | ConvertFrom-Json
    $DetailCount = ($DetailsData.PSObject.Properties | Measure-Object).Count
    $WithPopularity = 0
    $WithMonthly = 0
    foreach ($prop in $DetailsData.PSObject.Properties) {
        if ($prop.Value -and $prop.Value.popularity) { $WithPopularity++ }
        if ($prop.Value -and $prop.Value.popularity -and $prop.Value.popularity.monthly) { $WithMonthly++ }
    }
    Write-Host ""
    Write-Host "  Trail details:    $DetailCount (expected ~180+)" -ForegroundColor $(if ($DetailCount -ge 180) { 'Green' } else { 'Yellow' })
    Write-Host "  With popularity:  $WithPopularity"
    Write-Host "  With monthly:     $WithMonthly"
    if ($WithMonthly -lt 100) {
        Write-Host "  ! Low monthly data count - popularity may not be imported" -ForegroundColor Yellow
        $script:Warnings++
    }
} else {
    Write-Host "  Could not fetch trail details" -ForegroundColor Red
    $script:Errors++
}

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
