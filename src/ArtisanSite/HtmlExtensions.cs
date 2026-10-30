using System.Globalization;
using System.Text.Json;
using ArtisanSite.Models;
using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace ArtisanSite;

public static class HtmlExtensions
{
    /// <summary>Renders an &lt;img&gt; for a photo, with a lighter srcset candidate when one exists.</summary>
    public static IHtmlContent Photo(this IHtmlHelper html, Photo photo, string? cssClass = null, string sizes = "100vw", bool eager = false)
    {
        var pathBase = html.ViewContext.HttpContext.Request.PathBase;
        var img = new TagBuilder("img") { TagRenderMode = TagRenderMode.SelfClosing };
        img.Attributes["src"] = pathBase + "/assets/" + photo.File;
        if (photo.Small is not null && photo.SmallWidth is not null)
        {
            img.Attributes["srcset"] = string.Create(CultureInfo.InvariantCulture,
                $"{pathBase}/assets/{photo.Small} {photo.SmallWidth}w, {pathBase}/assets/{photo.File} {photo.Width}w");
            img.Attributes["sizes"] = sizes;
        }

        img.Attributes["alt"] = photo.Alt;
        img.Attributes["width"] = photo.Width.ToString(CultureInfo.InvariantCulture);
        img.Attributes["height"] = photo.Height.ToString(CultureInfo.InvariantCulture);
        if (!string.IsNullOrEmpty(cssClass)) img.Attributes["class"] = cssClass;
        img.Attributes["loading"] = eager ? "eager" : "lazy";
        img.Attributes["decoding"] = "async";
        if (eager) img.Attributes["fetchpriority"] = "high";
        return img;
    }

    private static readonly JsonSerializerOptions ClientJson = new(JsonSerializerDefaults.Web);

    /// <summary>The catalogue data site.js needs, embedded as inert JSON (safe inside a script tag).</summary>
    public static IHtmlContent StudioData(this IHtmlHelper html, Studio studio, string collectionUrl)
    {
        var pathBase = html.ViewContext.HttpContext.Request.PathBase;
        string Src(int n) => pathBase + "/assets/" + (studio.PhotoAt(n).Small ?? studio.PhotoAt(n).File);
        var data = new
        {
            studio.Slug,
            studio.Name,
            studio.Phone,
            studio.Instagram,
            CollectionUrl = collectionUrl,
            Pieces = studio.Pieces.Select(p => new
            {
                p.Id,
                p.Title,
                p.Category,
                p.Description,
                Alt = studio.PhotoAt(p.Photos[0]).Alt,
                Images = p.Photos.Select(n => pathBase + "/assets/" + studio.PhotoAt(n).File),
                Thumbs = p.Photos.Select(Src),
            }),
            Gallery = studio.Photos.Select(ph => new
            {
                Src = pathBase + "/assets/" + ph.File,
                ph.Alt,
                ph.Title,
                ph.Width,
                ph.Height,
            }),
        };

        // The default encoder escapes <, > and & so the JSON cannot close the script element.
        return new HtmlString(JsonSerializer.Serialize(data, ClientJson));
    }
}
