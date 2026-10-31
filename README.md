# Triple Threads

Website for **Triple Threads** — Reine, Laure & Yara Abi Hanna, Sahel Aalma, Jounieh, Lebanon.
Built with **ASP.NET Core 10** (Razor Pages) and ready to run on **IIS**.

Address after setup: **https://triple-threads.duckdns.org** · IIS site name: **TripleThreads**

Five pages (home, collection, gallery, our story, contact), a filterable
collection, a photo lightbox, “My picks” saved in the visitor's browser, and an
enquiry form that prepares a WhatsApp or Instagram message. No database, no
payments, no tracking.

## What's in this repository

| Folder / file | What it is |
| --- | --- |
| `publish/` | The ready-built website. **IIS points at this folder.** |
| `src/ArtisanSite/Content/business.json` | All wording, contact details, categories, pieces and photo captions |
| `src/ArtisanSite/wwwroot/assets/` | Photos, logo and the social-share image |
| `src/ArtisanSite/Pages/` | Page templates (`.cshtml`) |
| `src/ArtisanSite/wwwroot/site.css`, `site.js` | Styles and behaviour |
| `src/ArtisanSite/appsettings.json` | Switches: public address, search engines, HTTPS redirect |
| `deployment/` | IIS install, update and publish scripts, plus full instructions |
| `research/` | Where the photos and facts came from |

## Put it on IIS (first time)

1. On the server, install the **ASP.NET Core 10 Hosting Bundle** once
   ([download page](https://dotnet.microsoft.com/download/dotnet/10.0) → “Hosting Bundle”),
   then restart IIS with `net stop was /y` and `net start w3svc`.
2. Clone this repository to `C:\Sites\BusinessWebsites\triple-threads`.
3. In Administrator PowerShell:

   ```powershell
   & "C:\Sites\BusinessWebsites\triple-threads\deployment\Install-IIS.ps1"
   ```

4. Open `http://triple-threads.duckdns.org/`, then add HTTPS with simple-acme.

Every step, with troubleshooting, is in [deployment/README.txt](deployment/README.txt).

## Update the live site

```powershell
& "C:\Sites\BusinessWebsites\triple-threads\deployment\Update-Website.ps1"
```

Downloads only what changed and swaps it in within a few seconds. No IIS restart.

## Change text or photos

1. Edit `src/ArtisanSite/Content/business.json` (and photos in `wwwroot/assets`).
2. Preview with the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0):
   `dotnet run --project src/ArtisanSite` → http://localhost:5080
3. Rebuild the deployable folder: `.\deployment\Publish-Site.ps1`
   (or `deployment/publish.sh` on macOS/Linux).
4. Commit `src` and `publish` together, push, then run Update-Website on the server.

If `business.json` has a mistake (a missing photo, a piece in an unknown
category, a typo in the JSON), the site refuses to start and the message names
the problem — so preview before pushing.

## Switches in `appsettings.json`

| Setting | Now | Meaning |
| --- | --- | --- |
| `PublicUrl` | `https://triple-threads.duckdns.org` | Used for share previews and canonical links |
| `AllowSearchEngines` | `false` | Keeps the site out of Google (robots.txt, meta tag, header). Set `true` only after the business approves a public launch. |
| `ForceHttps` | `false` | Set `true` after the HTTPS certificate works, to send visitors to https:// |

## Demo status

This is an independent demo built from the business's public portfolio. Owner
approval and permission to reuse the photos have not been obtained; prices,
stock, materials and delivery are deliberately not stated on the site. WhatsApp
availability of the public phone number is unverified, so copy, Instagram and
call alternatives are always offered. Details: [BUSINESS-NOTES.txt](BUSINESS-NOTES.txt)
and `research/`.
