param (
    [Parameter(Mandatory=$true)]
    [string]$Group
)

$sourceFile = ".env_$Group"
$targetFile = ".env"

if (-not (Test-Path -LiteralPath $sourceFile)) {
    Write-Error "Source file $sourceFile not found. Please create it first."
    exit 1
}

try {
    Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
    Write-Host "Successfully switched to $Group configuration ($sourceFile -> $targetFile)" -ForegroundColor Green
} catch {
    Write-Error ("Failed to copy {0}: {1}" -f $sourceFile, $_.Exception.Message)
    exit 1
}
