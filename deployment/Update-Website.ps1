# Download only changed Git objects and update this site's tracked static files.
[CmdletBinding()]
param([string]$GitPath = 'C:\Program Files\Git\cmd\git.exe')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath $GitPath -PathType Leaf)) { throw 'Git was not found. Pass -GitPath with the actual git.exe location.' }
if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { throw 'This folder was extracted from a ZIP. Clone the repository once to use incremental updates.' }
$status = & $GitPath -C $root status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Git status failed.' }
if ($status) { throw 'Local changes exist. Review git status and preserve them before pulling. Nothing was overwritten.' }
& $GitPath -C $root pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Update failed. Inspect the Git message above; do not use reset --hard.' }
Write-Host 'Update complete. Refresh the website with Ctrl+F5. No npm build or IIS restart is required.'
