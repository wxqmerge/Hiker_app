param(
    [string]$ProjectRoot,
    [string[]]$EnvFiles
)

$ErrorActionPreference = 'Stop'

$root = if ($ProjectRoot) { $ProjectRoot } else { Split-Path -Parent $PSScriptRoot }
$files = if ($EnvFiles) {
    $EnvFiles | ForEach-Object { [IO.Path]::GetFullPath([IO.Path]::Combine($root, $_)) }
} else {
    @(
        [IO.Path]::Combine($root, '.env'),
        [IO.Path]::Combine($root, '.env_sothh'),
        [IO.Path]::Combine($root, '.env_ramblers'),
        [IO.Path]::Combine($root, 'server', '.env')
    )
}

function Get-PlainSecureString {
    param([securestring]$SecureString)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$key = $env:NEW_ADMIN_API_KEY
if ([string]::IsNullOrWhiteSpace($key)) {
    $key = Get-PlainSecureString -SecureString (Read-Host -Prompt 'New ADMIN_API_KEY' -AsSecureString)
}
$key = $key.Trim()
if ([string]::IsNullOrWhiteSpace($key)) {
    throw 'A non-empty ADMIN_API_KEY is required.'
}

foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) {
        Write-Host "Skipped: $file (not found)"
        continue
    }

    $content = [IO.File]::ReadAllText($file)
    $replacement = "ADMIN_API_KEY=$($key.Replace('$', '$$'))"
    $pattern = '(?m)^ADMIN_API_KEY=[^\r\n]*(?=\r?$)'
    $updated = [regex]::Replace($content, $pattern, $replacement)

    if ($updated -eq $content) {
        $separator = if ($content.EndsWith("`n") -or [string]::IsNullOrWhiteSpace($content)) { '' } else { "`r`n" }
        $updated = $content + $separator + 'ADMIN_API_KEY=' + $key + "`r`n"
        Write-Host "Added: $file"
    } else {
        Write-Host "Updated: $file"
    }

    [IO.File]::WriteAllText($file, $updated)
}
