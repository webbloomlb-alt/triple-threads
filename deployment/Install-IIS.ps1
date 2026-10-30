# Compatible with Windows PowerShell 4 and IIS 8.5. Run on the VPS as Administrator.
[CmdletBinding()]
param(
    [switch]$PreviewOnly,
    [string]$HostName,
    [switch]$OpenFirewall
)
$ErrorActionPreference = 'Stop'
$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$configPath = Join-Path $siteRoot 'site.json'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'site.json is missing. Keep deployment inside its website folder.' }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$name = [string]$config.iis
$physicalPath = [IO.Path]::GetFullPath((Join-Path $siteRoot 'dist'))
if (-not (Test-Path -LiteralPath (Join-Path $physicalPath 'index.html') -PathType Leaf)) { throw 'dist\index.html is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $physicalPath 'web.config') -PathType Leaf)) { throw 'dist\web.config is missing.' }
if ([string]::IsNullOrWhiteSpace($HostName)) { $HostName = [string]$config.domain }
if ($HostName -notmatch '^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$') { throw 'Use a DNS host name, without https:// or a path.' }
if ($PreviewOnly) { $bindingIp = '127.0.0.1'; $bindingPort = [int]$config.port; $bindingHost = '' }
else { $bindingIp = '*'; $bindingPort = 80; $bindingHost = $HostName.ToLowerInvariant() }
$bindingInfo = $bindingIp + ':' + $bindingPort + ':' + $bindingHost
$admin = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open Windows PowerShell using Run as administrator.' }
Import-Module WebAdministration -ErrorAction Stop
$existing = Get-Website -Name $name -ErrorAction SilentlyContinue
if ($existing) {
    $oldPath = [Environment]::ExpandEnvironmentVariables([string]$existing.physicalPath)
    if ([IO.Path]::GetFullPath($oldPath).TrimEnd('\') -ine $physicalPath.TrimEnd('\')) {
        throw ('An IIS site named ' + $name + ' already uses a different folder. No changes made.')
    }
}
$allSites = @(Get-Website)
foreach ($other in $allSites) {
    foreach ($binding in @($other.bindings.Collection)) {
        if ([string]$binding.protocol -ne 'http') { continue }
        $parts = ([string]$binding.bindingInformation) -split ':',3
        if ($parts.Count -ne 3 -or [int]$parts[1] -ne $bindingPort) { continue }
        $hostMatches = $parts[2] -ieq $bindingHost
        $ipOverlaps = $parts[0] -eq '*' -or $bindingIp -eq '*' -or $parts[0] -eq $bindingIp
        if ($hostMatches -and $ipOverlaps -and $other.name -ine $name) {
            throw ('Binding conflict with existing IIS site ' + $other.name + '. No changes made.')
        }
    }
}
$poolPath = 'IIS:\AppPools\' + $name
if (Test-Path -LiteralPath $poolPath) {
    $shared = @($allSites | Where-Object { $_.applicationPool -ieq $name -and $_.name -ine $name })
    if ($shared.Count -gt 0) { throw 'The proposed application pool is shared with another site. No changes made.' }
}
$backupName = 'Before-' + $name + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Backup-WebConfiguration -Name $backupName
Write-Host ('IIS configuration backup: ' + $backupName)
if (-not (Test-Path -LiteralPath $poolPath)) { New-WebAppPool -Name $name | Out-Null }
Set-ItemProperty -LiteralPath $poolPath -Name managedRuntimeVersion -Value ''
$aclTarget = $physicalPath
& icacls.exe $aclTarget /grant '*S-1-5-32-568:(OI)(CI)(RX)' /T /C /Q
if ($LASTEXITCODE -ne 0) { throw 'Could not grant IIS read access. Check the folder permissions before continuing.' }
if (-not $existing) {
    New-Website -Name $name -PhysicalPath $physicalPath -ApplicationPool $name -IPAddress $bindingIp -Port $bindingPort -HostHeader $bindingHost | Out-Null
} else {
    Set-ItemProperty -LiteralPath ('IIS:\Sites\' + $name) -Name applicationPool -Value $name
    $already = @(Get-WebBinding -Name $name -Protocol http | Where-Object { $_.bindingInformation -eq $bindingInfo })
    if ($already.Count -eq 0) { New-WebBinding -Name $name -Protocol http -IPAddress $bindingIp -Port $bindingPort -HostHeader $bindingHost }
}
if ((Get-WebAppPoolState -Name $name).Value -ne 'Started') { Start-WebAppPool -Name $name }
if ((Get-Website -Name $name).State -ne 'Started') { Start-Website -Name $name }
if ($OpenFirewall -and -not $PreviewOnly) {
    foreach ($port in @(80,443)) {
        $rule = 'Artisan websites TCP ' + $port
        if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        }
    }
}
if ($PreviewOnly) { $url = 'http://127.0.0.1:' + $bindingPort + '/' }
else { $url = 'http://' + $HostName + '/' }
Write-Host ('Ready for HTTP testing: ' + $url)
Write-Host ('Physical folder: ' + $physicalPath)
Write-Host 'HTTPS: issue a certificate with your existing simple-acme, selecting this site only.'
Write-Host 'Use an HTTPS hostname binding on port 443 with Require Server Name Indication checked.'
