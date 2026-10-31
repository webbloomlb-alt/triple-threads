# Rebuilds the "publish" folder from src\ArtisanSite. Run this on your own computer after editing
# the content, photos or code, then commit and push both src and publish.
# Needs the .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0
[CmdletBinding()]
param([string]$DotnetPath = 'dotnet')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$project = Join-Path $root 'src\ArtisanSite\ArtisanSite.csproj'
$publish = Join-Path $root 'publish'
$staging = Join-Path ([IO.Path]::GetTempPath()) ('artisan-publish-' + [Guid]::NewGuid().ToString('N'))

if (-not (Get-Command $DotnetPath -ErrorAction SilentlyContinue)) { throw 'The .NET SDK was not found. Install the .NET 10 SDK, then open a new PowerShell window.' }

& $DotnetPath publish $project -c Release -r win-x64 --self-contained false -o $staging
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed. Read the error above (often a typo in Content\business.json).' }

# Mirror the new build into publish, keeping files the server creates (certificate checks, logs).
& robocopy.exe $staging $publish /MIR /NFL /NDL /NJH /NJS /NP /XD '.well-known' 'logs' /XF 'app_offline.htm'
if ($LASTEXITCODE -ge 8) { throw 'Copying the build into the publish folder failed.' }
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Host 'publish folder updated. Test with: dotnet run --project src\ArtisanSite, then commit src and publish together.' -ForegroundColor Green
