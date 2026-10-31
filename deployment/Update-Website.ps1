# Downloads only the changed files from GitHub and updates the running site.
# The site shows a short "updating" page for a few seconds while files are replaced.
[CmdletBinding()]
param([string]$GitPath = 'C:\Program Files\Git\cmd\git.exe')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath $GitPath -PathType Leaf)) { throw 'Git was not found. Pass -GitPath with the actual git.exe location.' }
if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { throw 'This folder was extracted from a ZIP. Clone the repository once to use incremental updates.' }

# Git writes progress to stderr; run it without turning that into a PowerShell error, then check the exit code.
function Invoke-Git {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & $GitPath -C $root @Arguments 2>&1 }
    finally { $ErrorActionPreference = $previous }
    $script:GitExitCode = $LASTEXITCODE
    return @($output | ForEach-Object { [string]$_ })
}

$status = Invoke-Git @('status', '--porcelain')
if ($script:GitExitCode -ne 0) { throw ('Git status failed: ' + ($status -join ' ')) }
if ($status.Count -gt 0) {
    $status | ForEach-Object { Write-Host $_ }
    throw 'Local changes exist (listed above). Review them with git status before updating. Nothing was overwritten.'
}

$fetch = Invoke-Git @('fetch', 'origin', 'main')
if ($script:GitExitCode -ne 0) { $fetch | ForEach-Object { Write-Host $_ }; throw 'Could not download updates from GitHub. Check the internet connection and GitHub sign-in.' }

$current = (Invoke-Git @('rev-parse', 'HEAD')) -join ''
$latest = (Invoke-Git @('rev-parse', 'origin/main')) -join ''
if ($current -eq $latest) { Write-Host 'Already up to date.'; return }
Invoke-Git @('merge-base', '--is-ancestor', 'HEAD', 'origin/main') | Out-Null
if ($script:GitExitCode -ne 0) { throw 'This copy has commits that are not on GitHub. Nothing was changed; ask for help before forcing anything.' }

# app_offline.htm makes IIS stop the app so its files are not locked while Git replaces them.
$offline = Join-Path $root 'publish\app_offline.htm'
$publishExists = Test-Path -LiteralPath (Join-Path $root 'publish')
if ($publishExists) {
    $html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Updating</title><body style="font-family:sans-serif;text-align:center;padding:80px 20px"><h1>Back in a moment</h1><p>The website is being updated. Please refresh in a few seconds.</p></body></html>'
    [IO.File]::WriteAllText($offline, $html, (New-Object Text.UTF8Encoding($false)))
    Start-Sleep -Seconds 3
}
try {
    $merge = Invoke-Git @('merge', '--ff-only', 'origin/main')
    $merge | ForEach-Object { Write-Host $_ }
    if ($script:GitExitCode -ne 0) { throw 'Update failed. Inspect the Git message above; do not use reset --hard.' }
} finally {
    if (Test-Path -LiteralPath $offline) { Remove-Item -LiteralPath $offline -Force }
}

Write-Host ('Updated ' + $current.Substring(0, 7) + ' -> ' + $latest.Substring(0, 7) + '.') -ForegroundColor Green
if (-not $publishExists) {
    Write-Host 'This update moves the site to ASP.NET Core. Now run deployment\Install-IIS.ps1 once (see deployment\README.txt).' -ForegroundColor Yellow
} else {
    Write-Host 'Refresh the website with Ctrl+F5. No IIS restart is needed.'
}
