# Triple Threads

Independent, portable website demo for Triple Threads in Lebanon. Five static pages,
real portfolio photos, collection filters, saved photo references and enquiry
drafts. Static HTML/CSS/JavaScript; no server runtime or build on the VPS.

## IIS

Domain: **triple-threads.duckdns.org**. Site: **TripleThreads**.
IIS physical root: this repository's **dist** folder.

On the VPS, clone this repository once into:
C:\Sites\BusinessWebsites\triple-threads

In Administrator PowerShell:

    & "C:\Sites\BusinessWebsites\triple-threads\deployment\Install-IIS.ps1"

Test HTTP first, then use the existing simple-acme installation to issue a
certificate for **this domain only**. The HTTPS binding requires port 443,
this exact hostname and SNI. See [complete IIS instructions](deployment/README.txt).

For future updates:

    & "C:\Sites\BusinessWebsites\triple-threads\deployment\Update-Website.ps1"

This pulls changed Git objects with --ff-only and refuses uncommitted local
changes. No full ZIP download, npm build or IIS restart is needed.

## Local preview and editing

    python -m http.server 8770 --bind 127.0.0.1 --directory dist

Open http://127.0.0.1:8770/. Edit source/site.css, source/site.js and the
business content in source/businesses.json. Rebuild with Python and Pillow:

    python -m pip install -r requirements.txt
    python source/build.py

After a rebuild, apply metadata:

    & .\deployment\Set-PublicUrl.ps1 -BaseUrl "https://triple-threads.duckdns.org"

Commit source and regenerated dist together. Contact details and photos load
locally; no Instagram hotlinks, external fonts, analytics or payment services.

## Scope and validation

Photos illustrate previous work; labels are descriptive, rather than confirmed
official product names. Current prices, stock, materials and timing must be
confirmed with the makers. The contact form builds a local draft; it sends
nothing. WhatsApp availability of the public phone is unverified; copy,
Instagram and call alternatives are provided.

Visitor-flow DOM tests and static asset checks passed. Browser dialog/clipboard
APIs were simulated in the DOM tests. Native browser/mobile layout QA was
unavailable because the Computer Use native pipe failed. Target IIS execution
and HTTPS issuance have not been performed locally.

No matching standalone business website was found in bounded public research,
but absence is not owner-confirmed. This is an independent demo; no owner
approval or image republication license was established. Research and source
provenance are in [business notes](BUSINESS-NOTES.txt) and research/.

Preview indexing is disabled in **HTML, robots.txt and web.config**. Remove all
three noindex mechanisms only for an approved business launch.
