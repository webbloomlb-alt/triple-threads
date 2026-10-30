# Creates (or repairs) this website's IIS site for the ASP.NET Core app in the "publish" folder.
# Works with Windows PowerShell 4/5 and IIS 8.5 or newer. Run on the VPS as Administrator.
# Safe to run again: it never deletes sites, bindings or certificates.
[CmdletBinding()]
param(
    [switch]$PreviewOnly,
    [string]$HostName,
    [switch]$OpenFirewall
)
$ErrorActionPreference = 'Stop'

$admin = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open Windows PowerShell using Run as administrator.' }

$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$configPath = Join-Path $siteRoot 'site.json'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'site.json is missing. Keep the deployment folder inside its website folder.' }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$name = [string]$config.iis
$physicalPath = [IO.Path]::GetFullPath((Join-Path $siteRoot 'publish'))
$oldStaticPath = [IO.Path]::GetFullPath((Join-Path $siteRoot 'dist'))

foreach ($required in @('web.config', 'ArtisanSite.dll', 'ArtisanSite.exe', 'Content\business.json', 'wwwroot\site.css')) {
    if (-not (Test-Path -LiteralPath (Join-Path $physicalPath $required) -PathType Leaf)) {
        throw ('publish\' + $required + ' is missing. Run Update-Website.ps1 (or git pull) so the folder is complete.')
    }
}

if ([string]::IsNullOrWhiteSpace($HostName)) { $HostName = [string]$config.domain }
if ($HostName -notmatch '^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$') { throw 'Use a DNS host name, without https:// or a path.' }
if ($PreviewOnly) { $bindingIp = '127.0.0.1'; $bindingPort = [int]$config.port; $bindingHost = '' }
else { $bindingIp = '*'; $bindingPort = 80; $bindingHost = $HostName.ToLowerInvariant() }
$bindingInfo = $bindingIp + ':' + $bindingPort + ':' + $bindingHost

Import-Module WebAdministration -ErrorAction Stop

# ASP.NET Core needs the .NET Hosting Bundle (ASP.NET Core Module + runtime) installed once per server.
$hostingBundleHelp = @(
    'Install the ASP.NET Core 10 Hosting Bundle once on this server:',
    '  1. Open https://dotnet.microsoft.com/download/dotnet/10.0',
    '  2. Under "ASP.NET Core Runtime", Windows, click "Hosting Bundle" and run the installer.',
    '  3. Restart IIS: net stop was /y   then   net start w3svc',
    '  4. Run this script again.'
) -join [Environment]::NewLine
$module = Get-WebGlobalModule -Name 'AspNetCoreModuleV2' -ErrorAction SilentlyContinue
if (-not $module) { throw ('The ASP.NET Core Module is not installed in IIS.' + [Environment]::NewLine + $hostingBundleHelp) }
$runtimeRoot = Join-Path $env:ProgramFiles 'dotnet\shared\Microsoft.AspNetCore.App'
$runtimes = @()
if (Test-Path -LiteralPath $runtimeRoot) { $runtimes = @(Get-ChildItem -LiteralPath $runtimeRoot -Directory | Where-Object { $_.Name -like '10.*' }) }
if ($runtimes.Count -eq 0) { throw ('The ASP.NET Core 10 runtime (64-bit) is not installed.' + [Environment]::NewLine + $hostingBundleHelp) }
Write-Host ('ASP.NET Core runtime found: ' + (($runtimes | ForEach-Object { $_.Name }) -join ', '))

$existing = Get-Website -Name $name -ErrorAction SilentlyContinue
$moveFromStatic = $false
if ($existing) {
    $oldPath = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables([string]$existing.physicalPath)).TrimEnd('\')
    if ($oldPath -ieq $oldStaticPath.TrimEnd('\')) { $moveFromStatic = $true }
    elseif ($oldPath -ine $physicalPath.TrimEnd('\')) {
        throw ('An IIS site named ' + $name + ' already uses a different folder (' + $oldPath + '). No changes made.')
    }
}

$allSites = @(Get-Website)
foreach ($other in $allSites) {
    foreach ($binding in @($other.bindings.Collection)) {
        if ([string]$binding.protocol -ne 'http') { continue }
        $parts = ([string]$binding.bindingInformation) -split ':', 3
        if ($parts.Count -ne 3 -or [string]$parts[1] -ne [string]$bindingPort) { continue }
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
    if ($shared.Count -gt 0) { throw 'The application pool is shared with another site. ASP.NET Core needs its own pool. No changes made.' }
}

$backupName = 'Before-' + $name + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Backup-WebConfiguration -Name $backupName
Write-Host ('IIS configuration backup: ' + $backupName)

# One pool per site, "No Managed Code" (ASP.NET Core runs its own runtime), 64-bit.
if (-not (Test-Path -LiteralPath $poolPath)) { New-WebAppPool -Name $name | Out-Null }
Set-ItemProperty -LiteralPath $poolPath -Name managedRuntimeVersion -Value ''
Set-ItemProperty -LiteralPath $poolPath -Name enable32BitAppOnWin64 -Value $false
Set-ItemProperty -LiteralPath $poolPath -Name processModel.loadUserProfile -Value $true

& icacls.exe $physicalPath /grant '*S-1-5-32-568:(OI)(CI)(RX)' /T /C /Q
if ($LASTEXITCODE -ne 0) { throw 'Could not grant IIS read access. Check the folder permissions before continuing.' }

if (-not $existing) {
    New-Website -Name $name -PhysicalPath $physicalPath -ApplicationPool $name -IPAddress $bindingIp -Port $bindingPort -HostHeader $bindingHost | Out-Null
} else {
    if ($moveFromStatic) {
        Set-ItemProperty -LiteralPath ('IIS:\Sites\' + $name) -Name physicalPath -Value $physicalPath
        Write-Host 'Moved the site from the old static dist folder to the ASP.NET Core publish folder.'
    }
    Set-ItemProperty -LiteralPath ('IIS:\Sites\' + $name) -Name applicationPool -Value $name
    $already = @(Get-WebBinding -Name $name -Protocol http | Where-Object { $_.bindingInformation -eq $bindingInfo })
    if ($already.Count -eq 0) { New-WebBinding -Name $name -Protocol http -IPAddress $bindingIp -Port $bindingPort -HostHeader $bindingHost }
}

if ((Get-WebAppPoolState -Name $name).Value -ne 'Started') { Start-WebAppPool -Name $name }
else { Restart-WebAppPool -Name $name }
if ((Get-Website -Name $name).State -ne 'Started') { Start-Website -Name $name }

if ($OpenFirewall -and -not $PreviewOnly) {
    foreach ($port in @(80, 443)) {
        $rule = 'Artisan websites TCP ' + $port
        if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        }
    }
}

# Ask the site for its home page through IIS on this machine.
if ($PreviewOnly) { $testUrl = 'http://127.0.0.1:' + $bindingPort + '/'; $testHost = $null }
else { $testUrl = 'http://127.0.0.1/'; $testHost = $bindingHost }
$status = 0
try {
    $request = [Net.HttpWebRequest]::Create($testUrl)
    if ($testHost) { $request.Host = $testHost }
    $request.Timeout = 60000
    $request.AllowAutoRedirect = $false
    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $response.Close()
} catch [Net.WebException] {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
}

if ($PreviewOnly) { $url = 'http://127.0.0.1:' + $bindingPort + '/' }
else { $url = 'http://' + $HostName + '/' }
Write-Host ''
if ($status -eq 200) {
    Write-Host ('OK - the site answered through IIS. Open: ' + $url) -ForegroundColor Green
} else {
    Write-Host ('The site did not answer with 200 OK (status: ' + $status + ').') -ForegroundColor Yellow
    Write-Host 'Check: Event Viewer > Windows Logs > Application (source "IIS AspNetCore Module V2"),'
    Write-Host 'and the TROUBLESHOOTING section of deployment\README.txt.'
}
Write-Host ('Physical folder: ' + $physicalPath)
Write-Host 'HTTPS: issue a certificate with your existing simple-acme, selecting this site only.'
Write-Host 'Use an HTTPS hostname binding on port 443 with Require Server Name Indication checked.'
