using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using System.Text.Unicode;
using ArtisanSite;
using ArtisanSite.Models;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.WebEncoders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection("Site"));
builder.Services.AddSingleton(_ => Studio.Load(Path.Combine(builder.Environment.ContentRootPath, "Content", "business.json")));
builder.Services.AddRazorPages();
builder.Services.AddRouting(options => options.LowercaseUrls = true);
// Write characters such as ’ and — as-is instead of &#x2019; entities.
builder.Services.Configure<WebEncoderOptions>(options => options.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["image/svg+xml"]);
});

var app = builder.Build();

// Read the content file now, so a mistake in it stops start-up with a clear message.
app.Services.GetRequiredService<Studio>();
var site = app.Services.GetRequiredService<IOptions<SiteOptions>>().Value;

const string ContentSecurityPolicy =
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; " +
    "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

app.Use((context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "SAMEORIGIN";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        headers.ContentSecurityPolicy = ContentSecurityPolicy;
        if (!site.AllowSearchEngines) headers["X-Robots-Tag"] = "noindex, nofollow";
        if (site.ForceHttps && context.Request.IsHttps) headers.StrictTransportSecurity = "max-age=2592000";
        return Task.CompletedTask;
    });
    return next(context);
});

// Let's Encrypt HTTP validation: simple-acme writes token files to <site folder>\.well-known\acme-challenge.
var acmeFolder = Path.Combine(app.Environment.ContentRootPath, ".well-known", "acme-challenge");
var acmeToken = new Regex("^[A-Za-z0-9_-]{1,256}$", RegexOptions.CultureInvariant);
app.Use(async (context, next) =>
{
    const string prefix = "/.well-known/acme-challenge/";
    var path = context.Request.Path.Value ?? "";
    if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
    {
        var token = path[prefix.Length..];
        var file = Path.Combine(acmeFolder, token);
        if (acmeToken.IsMatch(token) && File.Exists(file))
        {
            context.Response.ContentType = "text/plain";
            await context.Response.SendFileAsync(file);
            return;
        }
    }

    await next(context);
});

if (site.ForceHttps)
{
    app.Use((context, next) =>
    {
        if (!context.Request.IsHttps)
        {
            var target = $"https://{context.Request.Host.Host}{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}";
            context.Response.Redirect(target, permanent: true);
            return Task.CompletedTask;
        }

        return next(context);
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
}

app.UseStatusCodePagesWithReExecute("/status/{0}");
app.UseResponseCompression();

// Addresses from the earlier static version (collection.html, about.html ...) keep working.
var legacyPages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["/index.html"] = "/",
    ["/collection.html"] = "/collection",
    ["/gallery.html"] = "/gallery",
    ["/about.html"] = "/about",
    ["/contact.html"] = "/contact",
};
app.Use((context, next) =>
{
    if (context.Request.Path.HasValue && legacyPages.TryGetValue(context.Request.Path.Value, out var target))
    {
        context.Response.Redirect(context.Request.PathBase + target + context.Request.QueryString, permanent: true);
        return Task.CompletedTask;
    }

    return next(context);
});

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = file =>
    {
        // site.css?v=... and site.js?v=... change name whenever they change, so they can be cached for a year.
        var versioned = file.Context.Request.Query.ContainsKey("v");
        file.Context.Response.Headers.CacheControl = versioned ? "public, max-age=31536000, immutable" : "public, max-age=604800";
    },
});

app.UseRouting();
app.MapRazorPages();

app.MapGet("/robots.txt", (HttpRequest request) =>
{
    var text = site.AllowSearchEngines
        ? $"User-agent: *\nAllow: /\nSitemap: {site.BaseUrl(request)}/sitemap.xml\n"
        : "User-agent: *\nDisallow: /\n";
    return Results.Text(text, "text/plain", Encoding.UTF8);
});

app.MapGet("/sitemap.xml", (HttpRequest request) =>
{
    if (!site.AllowSearchEngines) return Results.NotFound();
    var baseUrl = System.Security.SecurityElement.Escape(site.BaseUrl(request));
    var urls = string.Concat(new[] { "/", "/collection", "/gallery", "/about", "/contact" }
        .Select(path => $"<url><loc>{baseUrl}{path}</loc></url>"));
    return Results.Text($"<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">{urls}</urlset>",
        "application/xml", Encoding.UTF8);
});

app.Run();
