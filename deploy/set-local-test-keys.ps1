function Set-SecretEnvironmentVariable {
    param(
        [string]$Name,
        [string]$Prompt,
        [string]$Scope = 'User'
    )

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    if ([string]::IsNullOrWhiteSpace($plain)) {
        Write-Host "Skipped: $Name"
        return
    }

    [Environment]::SetEnvironmentVariable($Name, $plain.Trim(), $Scope)
    Write-Host "Saved: $Name"
}

Set-SecretEnvironmentVariable -Name 'SOThH_DEV_ADMIN_API_KEY' -Prompt 'Sothh dev admin key (Enter to skip)'
Set-SecretEnvironmentVariable -Name 'RAMBLERS_ADMIN_API_KEY' -Prompt 'Ramblers admin key (Enter to skip)'

Write-Host 'Open a new terminal to load the updated variables.'
