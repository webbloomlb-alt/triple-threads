namespace ArtisanSite;

/// <summary>Switches read from the "Site" section of appsettings.json.</summary>
public sealed class SiteOptions
{
    /// <summary>Public address, e.g. https://example.duckdns.org. Used for share links and canonical URLs.</summary>
    public string? PublicUrl { get; set; }

    /// <summary>False keeps the site out of Google (robots.txt, meta tag and X-Robots-Tag header).</summary>
    public bool AllowSearchEngines { get; set; }

    /// <summary>Redirect http:// to https://. Turn on only after the HTTPS certificate works.</summary>
    public bool ForceHttps { get; set; }

    public string BaseUrl(HttpRequest request)
    {
        if (!string.IsNullOrWhiteSpace(PublicUrl))
        {
            return PublicUrl.Trim().TrimEnd('/');
        }

        return $"{request.Scheme}://{request.Host}{request.PathBase}";
    }
}
