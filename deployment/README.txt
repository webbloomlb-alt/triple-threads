IIS DEPLOYMENT - ASP.NET CORE 10 - WINDOWS SERVER / WINDOWS POWERSHELL

Each website is an ASP.NET Core 10 application. The ready-built application is
in the repository's "publish" folder, and IIS points at that folder. Nothing is
compiled on the VPS: Git downloads the files and IIS runs them.

DOMAINS SELECTED BY BILAL
The Wooden Knots: the-wooden-knots.duckdns.org
Triple Threads: triple-threads.duckdns.org
Macrame By Manar: macrame-by-manar.duckdns.org
VPS IP from the user's deployment: 103.215.75.161
All three DNS A records should point to that same VPS IP.


0. ONE-TIME SERVER PREPARATION (do this once for all three sites)

a) IIS features. Server Manager > Add Roles and Features > Web Server (IIS) >
   Web Server > Common HTTP Features. Make sure these are ticked:
     - Static Content      (simple-acme needs it for HTTPS validation)
     - Default Document
     - HTTP Errors

b) Git for Windows: https://git-scm.com/download/win (default options).

c) The ASP.NET Core 10 Hosting Bundle. This adds the ASP.NET Core Module to IIS
   and the .NET runtime. Without it the sites show "HTTP Error 500.19".
     1. Open https://dotnet.microsoft.com/download/dotnet/10.0
     2. In the "ASP.NET Core Runtime" column, under Windows, click "Hosting Bundle".
     3. Run the downloaded installer.
     4. Restart IIS. In Administrator PowerShell, run each line separately:
          net stop was /y
          net start w3svc
   Windows Server 2012 R2 is supported. Install pending Windows Updates first if
   the installer complains.


1. CLONE EACH WEBSITE ONCE
Open Windows PowerShell as Administrator. Run each line separately.
The & before the quoted git.exe path is required.

New-Item -ItemType Directory -Path "C:\Sites\BusinessWebsites" -Force
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/the-wooden-knots.git "C:\Sites\BusinessWebsites\the-wooden-knots"
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/triple-threads.git "C:\Sites\BusinessWebsites\triple-threads"
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/macrame-by-manar.git "C:\Sites\BusinessWebsites\macrame-by-manar"

The repositories are private. Git asks you to sign in to GitHub the first time;
use the browser/device prompt it shows. Never put a password or token in a URL.

If a folder already exists from the earlier static (HTML-only) version, update it
instead of cloning again - see "MOVING FROM THE OLD STATIC VERSION" below.


2. CREATE EACH IIS SITE

& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1"
& "C:\Sites\BusinessWebsites\triple-threads\deployment\Install-IIS.ps1"
& "C:\Sites\BusinessWebsites\macrame-by-manar\deployment\Install-IIS.ps1"

If Windows says scripts are disabled, run one script at a time with:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1"
Repeat with the other two folder names. This applies to that window only.

The script:
- Requires Administrator, IIS and the Hosting Bundle (it tells you if one is missing).
- Refuses a conflicting binding, or an existing same-name site that uses a
  different folder. It never removes existing sites, bindings or certificates.
- Saves an IIS configuration backup before changing anything.
- Creates the site's own application pool: No Managed Code, 64-bit.
  (ASP.NET Core always needs one pool per site.)
- Grants IIS_IUSRS read access to the publish folder (no write access).
- Adds the HTTP binding: port 80, host name = the site's DuckDNS name.
- Asks the site for its home page and prints OK, or what to check.
- Does not touch Joy Box, Crafts Corner or any other website.

For a private test on the VPS only, add -PreviewOnly:
& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1" -PreviewOnly
Preview ports: 8081 Wooden Knots, 8082 Triple Threads, 8083 Manar (this machine only).
Run again without -PreviewOnly to add the public binding.

If Windows Firewall blocks the sites, add -OpenFirewall. It adds only inbound
TCP 80 and 443 rules. Your VPS provider's firewall is separate.


3. TEST HTTP FIRST
Open these on the VPS and from your phone:
http://the-wooden-knots.duckdns.org/
http://triple-threads.duckdns.org/
http://macrame-by-manar.duckdns.org/

Each must show its own business. In IIS > site > Bindings, HTTP should be:
Type http | IP All Unassigned | Port 80 | Host name = that site's exact domain.
Do not use an empty host name for these public bindings.


4. HTTPS CERTIFICATES (simple-acme)
Use the simple-acme you already used for Crafts Corner:
C:\Users\Administrator\Downloads\simple-acme.v2.4.1.2444.win-x64.pluggable\wacs.exe
If you move it, keep it in a permanent folder and update its renewal task path.

Run wacs.exe as Administrator.
- Choose: create a new certificate using IIS bindings.
- Select ONE of the new sites and its exact domain only.
- Allow HTTP validation and installation in IIS.
- Repeat for the other two sites.
Menu letters/numbers can vary: follow the displayed site and domain names.
Never select all domains just because it is the default.

The websites answer Let's Encrypt's validation requests themselves, and the
validation files are ignored by Git, so they never block updates.

After issuance, check IIS > each site > Bindings:
Type https | IP All Unassigned | Port 443 | Host name = that site's DuckDNS name
"Require Server Name Indication" CHECKED | certificate covering that exact name.
Keep port 80 open: certificate renewals use it.

Optional, after HTTPS works for a site: send visitors from http:// to https://
automatically. Ask for "ForceHttps" to be switched on in that site's
src/ArtisanSite/appsettings.json (then Publish-Site.ps1, commit, push, update).
Renewal validation keeps working when it is on.


5. FUTURE UPDATES - ONLY CHANGES ARE DOWNLOADED

& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Update-Website.ps1"
& "C:\Sites\BusinessWebsites\triple-threads\deployment\Update-Website.ps1"
& "C:\Sites\BusinessWebsites\macrame-by-manar\deployment\Update-Website.ps1"

The script checks for local edits, downloads the changes, shows a short
"Back in a moment" page for a few seconds while files are swapped, and finishes.
No IIS restart is needed. Do not edit files on the VPS: edit the repository,
publish, commit and push, then run the update.


MOVING FROM THE OLD STATIC VERSION
If you already installed the earlier HTML-only version (IIS folder ...\dist):
  1. Install the Hosting Bundle (step 0c).
  2. Run that site's Update-Website.ps1. If it says "Local changes exist" and
     lists only dist\.well-known files, delete that dist\.well-known folder and
     run it again.
  3. Run that site's Install-IIS.ps1. It moves the IIS site from dist to publish.


EDITING TEXT, PHOTOS OR CODE (on your own computer)
- All wording, contact details, categories, pieces and photo captions are in
  src\ArtisanSite\Content\business.json.
- Photos are in src\ArtisanSite\wwwroot\assets.
- Pages are the .cshtml files in src\ArtisanSite\Pages; styles are
  wwwroot\site.css; behaviour is wwwroot\site.js.
Install the .NET 10 SDK, then from the repository folder:
  dotnet run --project src\ArtisanSite        (preview at http://localhost:5080)
  .\deployment\Publish-Site.ps1               (rebuilds the publish folder)
Commit src AND publish together and push. A mistake in business.json stops the
site from starting with a message that names the problem, so always preview first.


TROUBLESHOOTING
HTTP Error 500.19        Hosting Bundle missing, or IIS not restarted after installing it.
HTTP Error 500.30/500.31 The app could not start. Event Viewer > Windows Logs > Application,
                         source "IIS AspNetCore Module V2" shows the reason
                         (for example a typo in business.json or a missing runtime).
HTTP Error 503           The application pool is stopped. IIS Manager > Application Pools >
                         the site's pool > Start. Then check Event Viewer.
Wrong website shows      The binding host name does not match the domain exactly.
HTTPS validation fails   Check port 80 is open, the HTTP binding exists, and the
                         Static Content feature is installed (step 0a).


DEMO STATUS
All three are independent demos built from public business portfolio references.
Owner approval, image reuse authorisation, current stock/prices and the absence
of another official website are not confirmed. See BUSINESS-NOTES.txt and research/.
There is no payment or order backend: visitors prepare a WhatsApp/Instagram
message themselves. WhatsApp availability of the public numbers is unconfirmed;
copy, Instagram and call alternatives are included.
Search engines are blocked (robots.txt, meta tag and X-Robots-Tag header) until
"AllowSearchEngines" is set to true in appsettings.json. That setting does not
restrict who can open the site.
Tested locally: every page on desktop and phone sizes, plus automated visitor
flows (saved picks, filters, gallery, enquiry drafts, redirects, headers, 404).
IIS itself, public DNS and certificate issuance must be checked on the VPS.
