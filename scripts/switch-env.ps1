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
    # Remove server/.env to prevent dotenv from loading it first and overriding root .env
    $serverEnv = "server\.env"
    if (Test-Path -LiteralPath $serverEnv) {
        $backupFile = "server\.env.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item -LiteralPath $serverEnv -Destination $backupFile
        Remove-Item -LiteralPath $serverEnv -Force
        Write-Host "Backed up $serverEnv to $backupFile and removed to prevent env var conflicts" -ForegroundColor Yellow
    }
    Write-Host "Successfully switched to $Group configuration ($sourceFile -> $targetFile)" -ForegroundColor Green
} catch {
    Write-Error ("Failed to copy {0}: {1}" -f $sourceFile, $_.Exception.Message)
    exit 1
}
