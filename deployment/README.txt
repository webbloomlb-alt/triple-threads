IIS DEPLOYMENT — WINDOWS SERVER / WINDOWS POWERSHELL

These websites are static. No Node.js, npm, database or build step is needed on
the VPS. Each IIS web root must be that website's dist folder.

DOMAINS SELECTED BY BILAL
The Wooden Knots: the-wooden-knots.duckdns.org
Triple Threads: triple-threads.duckdns.org
Macrame By Manar: macrame-by-manar.duckdns.org
VPS IP from the user's deployment: 103.215.75.161
All three DNS A records should point to that same VPS IP.

RECOMMENDED: CLONE ONCE, THEN PULL ONLY CHANGES
Open Windows PowerShell as Administrator on the VPS.
Run each line separately. The & before the quoted git.exe path is required.

New-Item -ItemType Directory -Path "C:\Sites\BusinessWebsites" -Force
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/the-wooden-knots.git "C:\Sites\BusinessWebsites\the-wooden-knots"
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/triple-threads.git "C:\Sites\BusinessWebsites\triple-threads"
& "C:\Program Files\Git\cmd\git.exe" clone --depth 1 https://github.com/webbloomlb-alt/macrame-by-manar.git "C:\Sites\BusinessWebsites\macrame-by-manar"

The demo repositories are private. GitHub authentication is required on the VPS
with an account that can read them. Use the browser/device prompt Git presents.
Do not put a password or token in a clone URL.

ALTERNATIVE: EXTRACT THE ZIP
Use File Explorer > Extract All. With the combined ZIP, extract into
C:\Sites\BusinessWebsites so that it contains:
  C:\Sites\BusinessWebsites\the-wooden-knots\dist\index.html
  C:\Sites\BusinessWebsites\triple-threads\dist\index.html
  C:\Sites\BusinessWebsites\macrame-by-manar\dist\index.html
Avoid an extra nested folder. A ZIP extraction has no .git folder, so it cannot
use git pull. Clone once if you want future incremental updates.

1. CREATE EACH IIS SITE
These commands configure HTTP hostname bindings and read permissions:

& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1"
& "C:\Sites\BusinessWebsites\triple-threads\deployment\Install-IIS.ps1"
& "C:\Sites\BusinessWebsites\macrame-by-manar\deployment\Install-IIS.ps1"

If Windows says scripts are disabled, run one script at a time with:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1"
Repeat with the other two folder names. This applies to that process only.

The helper:
- Requires Administrator and the installed IIS WebAdministration module.
- Refuses a conflicting binding or an existing same-name site with a different
  physical folder. It never removes existing sites or bindings.
- Saves an IIS configuration backup before changes.
- Creates its own application pool with No Managed Code.
- Grants IIS_IUSRS read/execute permission to dist, not write access.
- Does not change your existing Joy Box, Crafts Corner or other websites.
- Does not create or install an HTTPS certificate.

IIS must have Static Content and Default Document installed. If a required
feature is missing, enable it in Server Manager > Add Roles and Features >
Web Server (IIS) > Web Server > Common HTTP Features.

For a local-only check on the VPS, use -PreviewOnly:
& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Install-IIS.ps1" -PreviewOnly
Preview ports: 8081 Wooden Knots, 8082 Triple Threads, 8083 Manar, loopback only.
Run again without -PreviewOnly to add the public HTTP hostname binding.

2. TEST HTTP FIRST
Open these on the VPS and from another device:
http://the-wooden-knots.duckdns.org/
http://triple-threads.duckdns.org/
http://macrame-by-manar.duckdns.org/

Each must show its own business. In IIS > site > Bindings, HTTP should have:
Type http | IP All Unassigned | Port 80 | Host name that site's exact domain.
Do not use an empty hostname for these three public HTTP bindings.
Keep TCP ports 80 and 443 reachable through the VPS provider firewall.
If Windows Firewall needs rules, explicitly pass -OpenFirewall to the installer;
it adds only inbound TCP 80/443 rules. Existing provider rules are separate.

3. ISSUE HTTPS CERTIFICATES
Use the simple-acme installation you already used for Crafts Corner:
C:\Users\Administrator\Downloads\simple-acme.v2.4.1.2444.win-x64.pluggable\wacs.exe
If you move it, keep it in a permanent folder and update its renewal task path.

Run wacs.exe as Administrator.
- Choose a new certificate using IIS bindings.
- Select ONE of the new sites and its exact domain only.
- Confirm the domain selection.
- Allow HTTP validation and IIS certificate installation.
- Repeat for the other two sites.
Menu letters/numbers can vary: follow the displayed site/domain names.
Never select all domains merely because it is the default.

After successful issuance, open IIS > each site > Bindings:
Type https | IP All Unassigned | Port 443
Host name = that site's exact DuckDNS name
CHECK "Require Server Name Indication"
SSL certificate = the certificate covering that exact name.
Leave existing sites/certificates alone.

Open all three https:// URLs from another device. Confirm the correct business
and a valid certificate. Keep port 80 open for ACME HTTP renewal.
Confirm simple-acme has a scheduled renewal task and review its renewal status.
Only the certificate tool's success output confirms issuance.

This package does not require the URL Rewrite module and does not force an
HTTP-to-HTTPS redirect. If you want redirects, configure them after HTTPS
works, using a method installed on that server that preserves ACME validation.

4. FUTURE UPDATES — ONLY CHANGES
Once each folder is a Git clone:
& "C:\Sites\BusinessWebsites\the-wooden-knots\deployment\Update-Website.ps1"
& "C:\Sites\BusinessWebsites\triple-threads\deployment\Update-Website.ps1"
& "C:\Sites\BusinessWebsites\macrame-by-manar\deployment\Update-Website.ps1"

This runs git pull --ff-only after checking that there are no local changes.
No npm build, full ZIP download or server restart is required. Refresh Ctrl+F5.
Do not edit generated dist files on the VPS; commit changes to the repository.
If a Git pull refuses local changes, preserve/review them instead of resetting.

EDITING/BUILDING LOCALLY
Source templates and behaviour are in source/. source/build.py uses the
business's source photos/research to regenerate dist. It requires Python and
Pillow only on the editing machine. Run:
python source/build.py
Then apply deployment/Set-PublicUrl.ps1 with that site's https:// public URL,
test, commit source AND dist, and push.
Static HTML/CSS/JS files can also be edited directly, but a rebuild replaces
generated dist. Keep corresponding source changes if you use the generator.

DEMO STATUS AND TEST LIMITS
All are independent demos using public business portfolio references.
Owner approval, image reuse authorization, current stock/prices and website
absence are not confirmed. See BUSINESS-NOTES.txt and research provenance.
The drafts have no payment or order-processing backend. WhatsApp availability
of the public phone numbers is unconfirmed; copy/Instagram/call alternatives
are included.
Previews are noindex in HTML, robots.txt and web.config; noindex does not
restrict who can view a public URL.
Functional DOM tests and local-asset checks passed. Native desktop/mobile
rendering was not verified because the Computer Use native pipe was unavailable.
IIS execution, public connectivity and certificate installation must be checked
on the VPS; they were not performed from the local machine.
