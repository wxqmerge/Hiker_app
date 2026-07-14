param (
    [Parameter(Mandatory=$true)]
    [string]$Group
)

$sourceFile = ".env_$Group"
$targetFile = ".env"
$serverTargetFile = "server\.env"

if (-not (Test-Path -LiteralPath $sourceFile)) {
    Write-Error "Source file $sourceFile not found. Please create it first."
    exit 1
}

try {
    Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
    Copy-Item -LiteralPath $sourceFile -Destination $serverTargetFile -Force
    Write-Host "Successfully switched to $Group configuration ($sourceFile -> $targetFile, $serverTargetFile)" -ForegroundColor Green
} catch {
    Write-Error ("Failed to copy {0}: {1}" -f $sourceFile, $_.Exception.Message)
    exit 1
}
