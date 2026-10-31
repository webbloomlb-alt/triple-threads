using System.Text.Json;
using System.Text.Json.Serialization;

namespace ArtisanSite.Models;

/// <summary>
/// Everything the website says about the business. Loaded once from Content/business.json.
/// Fields documented as "HTML" may contain &lt;br&gt; and &lt;em&gt;; every other field is plain text.
/// </summary>
public sealed class Studio
{
    public string Slug { get; init; } = "";
    public string Name { get; init; } = "";
    /// <summary>Colour scheme: "wooden", "triple" or "manar".</summary>
    public string Theme { get; init; } = "wooden";

    public string Phone { get; init; } = "";
    public string PhoneDisplay { get; init; } = "";
    public string? Email { get; init; }
    public string Instagram { get; init; } = "";
    public string InstagramHandle { get; init; } = "";
    public string Location { get; init; } = "";
    public string Makers { get; init; } = "";
    public string Address { get; init; } = "";
    public string MapUrl { get; init; } = "";

    public string Eyebrow { get; init; } = "";
    /// <summary>HTML.</summary>
    public string Headline { get; init; } = "";
    public string Intro { get; init; } = "";
    public string PhotoTag { get; init; } = "";
    /// <summary>HTML.</summary>
    public string Stamp { get; init; } = "";

    /// <summary>Photo numbers (1 = first entry in <see cref="Photos"/>).</summary>
    public int HeroPhoto { get; init; }
    public int InsetPhoto { get; init; }
    public int StoryPhoto { get; init; }
    /// <summary>Piece ids shown on the home page, in order.</summary>
    public List<string> Featured { get; init; } = [];

    public string StoryLabel { get; init; } = "";
    /// <summary>HTML.</summary>
    public string StoryTitle { get; init; } = "";
    public string StoryShort { get; init; } = "";
    public string StoryLong { get; init; } = "";
    public string StorySecond { get; init; } = "";
    /// <summary>HTML.</summary>
    public string Statement { get; init; } = "";
    public string Visit { get; init; } = "";
    /// <summary>HTML.</summary>
    public string ClosingTitle { get; init; } = "";
    public string ClosingText { get; init; } = "";
    public string CollectionIntro { get; init; } = "";
    public string GalleryIntro { get; init; } = "";

    public List<string> Categories { get; init; } = [];
    public List<Photo> Photos { get; init; } = [];
    public List<Piece> Pieces { get; init; } = [];

    [JsonIgnore] public string PhoneDigits => new(Phone.Where(char.IsAsciiDigit).ToArray());
    [JsonIgnore] public string WhatsAppUrl => "https://wa.me/" + PhoneDigits;
    [JsonIgnore] public IEnumerable<Piece> FeaturedPieces => Featured.Select(id => Pieces.First(p => p.Id == id));

    [JsonIgnore]
    public string ThemeColor => Theme switch
    {
        "triple" => "#fff4f0",
        "manar" => "#f4f3ec",
        _ => "#f6f1e9",
    };

    public Photo PhotoAt(int number) => Photos[number - 1];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static Studio Load(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException("The business content file is missing.", path);
        }

        Studio studio;
        try
        {
            studio = JsonSerializer.Deserialize<Studio>(File.ReadAllText(path), JsonOptions)
                ?? throw new InvalidDataException("The file is empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException($"{path} is not valid JSON: {ex.Message}", ex);
        }

        var problems = studio.Validate(Path.Combine(Path.GetDirectoryName(path)!, "..", "wwwroot", "assets"));
        if (problems.Count > 0)
        {
            throw new InvalidDataException($"{path} has problems:{Environment.NewLine} - " + string.Join(Environment.NewLine + " - ", problems));
        }

        return studio;
    }

    /// <summary>Returns a readable list of mistakes, so a typo stops the site with a clear message.</summary>
    public List<string> Validate(string? assetsFolder = null)
    {
        var problems = new List<string>();
        void Require(string value, string field)
        {
            if (string.IsNullOrWhiteSpace(value)) problems.Add($"\"{field}\" is empty.");
        }

        Require(Slug, "slug");
        Require(Name, "name");
        Require(Phone, "phone");
        Require(Instagram, "instagram");
        if (Theme is not ("wooden" or "triple" or "manar")) problems.Add("\"theme\" must be wooden, triple or manar.");
        if (Photos.Count == 0) problems.Add("\"photos\" is empty.");
        if (Pieces.Count == 0) problems.Add("\"pieces\" is empty.");

        void CheckPhoto(int number, string field)
        {
            if (number < 1 || number > Photos.Count) problems.Add($"\"{field}\" is {number}, but there are {Photos.Count} photos.");
        }

        CheckPhoto(HeroPhoto, "heroPhoto");
        CheckPhoto(InsetPhoto, "insetPhoto");
        CheckPhoto(StoryPhoto, "storyPhoto");

        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var piece in Pieces)
        {
            if (string.IsNullOrWhiteSpace(piece.Id) || !piece.Id.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c == '-'))
                problems.Add($"Piece id \"{piece.Id}\" must use lowercase letters, digits and dashes only.");
            if (!ids.Add(piece.Id)) problems.Add($"Piece id \"{piece.Id}\" is used twice.");
            if (!Categories.Contains(piece.Category)) problems.Add($"Piece \"{piece.Id}\" uses category \"{piece.Category}\", which is not in \"categories\".");
            if (piece.Photos.Count == 0) problems.Add($"Piece \"{piece.Id}\" has no photos.");
            foreach (var n in piece.Photos) CheckPhoto(n, $"pieces[{piece.Id}].photos");
        }

        foreach (var id in Featured)
        {
            if (!ids.Contains(id)) problems.Add($"\"featured\" lists \"{id}\", which is not a piece id.");
        }

        if (assetsFolder is not null && Directory.Exists(assetsFolder))
        {
            foreach (var photo in Photos)
            {
                foreach (var file in new[] { photo.File, photo.Small }.OfType<string>())
                {
                    if (!File.Exists(Path.Combine(assetsFolder, file))) problems.Add($"Photo file wwwroot/assets/{file} does not exist.");
                }
            }
        }

        return problems;
    }
}

public sealed class Photo
{
    /// <summary>File name inside wwwroot/assets.</summary>
    public string File { get; init; } = "";
    public int Width { get; init; }
    public int Height { get; init; }
    public string Title { get; init; } = "";
    public string Alt { get; init; } = "";
    /// <summary>Optional lighter copy used for cards and thumbnails.</summary>
    public string? Small { get; init; }
    public int? SmallWidth { get; init; }
}

public sealed class Piece
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string Category { get; init; } = "";
    public string Description { get; init; } = "";
    /// <summary>Photo numbers; the first one is the cover.</summary>
    public List<int> Photos { get; init; } = [];
}

/// <summary>Heading block at the top of the inner pages. <see cref="TitleHtml"/> may contain &lt;br&gt; and &lt;em&gt;.</summary>
public sealed record PageIntro(string Eyebrow, string TitleHtml, string Lede);
