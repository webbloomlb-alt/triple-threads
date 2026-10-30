# Updates canonical and social-share links. It does not install a certificate.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$uri = $null
if (-not [Uri]::TryCreate($BaseUrl,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -notin @('http','https') -or $uri.Query -or $uri.Fragment -or $uri.UserInfo) { throw 'Use a public http:// or https:// URL without credentials, a query or a fragment.' }
if ($uri.HostNameType -ne [UriHostNameType]::Dns) { throw 'Use the public domain name so metadata identifies the correct IIS site.' }
$base = $BaseUrl.TrimEnd('/') + '/'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\dist'))
$encoding = New-Object Text.UTF8Encoding($false)
$files = @(Get-ChildItem -LiteralPath $root -Filter '*.html' -File)
if ($files.Count -ne 5) { throw 'Expected the five website HTML pages inside dist.' }
foreach ($file in $files) {
    $text = [IO.File]::ReadAllText($file.FullName)
    if ($text -notmatch '<!-- PUBLIC_URL_START -->.*?<!-- PUBLIC_URL_END -->') { throw ('Metadata markers missing in ' + $file.Name) }
}
foreach ($file in $files) {
    $text = [IO.File]::ReadAllText($file.FullName)
    $page = if ($file.Name -eq 'index.html') { $base } else { $base + $file.Name }
    $url = [System.Security.SecurityElement]::Escape($page)
    $image = [System.Security.SecurityElement]::Escape($base + 'assets/social-card.jpg')
    $block = '<!-- PUBLIC_URL_START --><link rel="canonical" href="' + $url + '"><meta property="og:url" content="' + $url + '"><meta property="og:image" content="' + $image + '"><meta name="twitter:card" content="summary_large_image"><!-- PUBLIC_URL_END -->'
    $text = [regex]::Replace($text,'<!-- PUBLIC_URL_START -->.*?<!-- PUBLIC_URL_END -->',[System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block })
    [IO.File]::WriteAllText($file.FullName,$text,$encoding)
}
Write-Host ('Updated public metadata for ' + $base + ' in all five pages.')
Write-Host 'The preview noindex settings remain enabled.'
