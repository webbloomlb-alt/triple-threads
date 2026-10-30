"""Build three portable, dependency-free artisan website demos.
Run: python source/build.py. Pillow is only needed on the build machine.
The IIS server serves the generated dist folders without Python or Node.
"""
import hashlib
import html
import json
import shutil
from pathlib import Path, PureWindowsPath
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "source"
STANDALONE = (ROOT / "site.json").exists()
SELECTED_SLUG = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))["slug"] if STANDALONE else None
def esc(value): return html.escape(str(value), quote=True)
def read_research(slug):
    return json.loads((ROOT / "research" / slug / "research.json").read_text(encoding="utf-8-sig"))

BUSINESSES = json.loads((SOURCE / "businesses.json").read_text(encoding="utf-8"))

def image_tag(b, n, cls="", eager=False):
    p = b["gallery"][n-1]
    return '<img src="%s" alt="%s" width="%s" height="%s" class="%s" loading="%s" decoding="async"%s>' % (p["src"],esc(p["alt"]),p["width"],p["height"],cls,"eager" if eager else "lazy",' fetchpriority="high"' if eager else '')

def prepare(b):
    research = read_research(b["slug"])
    dist = ROOT / "dist" if STANDALONE else ROOT / b["slug"] / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    gallery=[]
    manifest=[]
    for i, item in enumerate(research["images"],1):
        original = ROOT / "research" / b["slug"] / "images" / PureWindowsPath(item["local_path"]).name
        dest = assets / ("photo-%02d.jpg" % i)
        with Image.open(original) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((1600,1600))
            im.save(dest,quality=89,optimize=True,progressive=True)
            w,h=im.size
        gallery.append(dict(src="assets/"+dest.name,alt=item.get("alt_text",item.get("alt","")),title=item.get("descriptive_name",item.get("descriptive_title",item.get("title","Craft detail"))),width=w,height=h))
        manifest.append(dict(file="assets/"+dest.name,source_page=item.get("source_page",item.get("source_page_url")),source_image=item["source_url"],original_size=[item["width"],item["height"]]))
    logo = research["brand_assets"][0] if "brand_assets" in research else research.get("profile_logo",research.get("brand_asset"))
    original = ROOT/"research"/b["slug"]/"images"/PureWindowsPath(logo["local_path"]).name
    with Image.open(original) as im:
        im=ImageOps.exif_transpose(im).convert("RGB");im.thumbnail((144,144));im.save(assets/"logo.jpg",quality=92,optimize=True)
    manifest.append(dict(file="assets/logo.jpg",source_page=logo.get("source_page",logo.get("source_page_url")),source_image=logo["source_url"]))
    b["gallery"]=gallery
    pieces=[]
    for n, pid, title, category, description, others in b["products"]:
        pieces.append(dict(id=pid,title=title,category=category,description=description,images=[gallery[j-1]["src"] for j in [n]+others],alt=gallery[n-1]["alt"],index=n))
    b["pieces"]=pieces
    public={k:b[k] for k in ["slug","name","phone","instagram","pieces","gallery"]}
    (dist/"catalogue.js").write_text("window.STUDIO = "+json.dumps(public,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    (dist/"asset-provenance.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    for name in ["site.css","site.js"]: shutil.copy2(SOURCE/name,dist/name)
    social_card(b,dist)
    return dist

def social_card(b,dist):
    colors={"wooden":("#f6f1e9","#30291f"),"triple":("#efcfcf","#294438"),"manar":("#f4f3ec","#333d2b")}
    bg,ink=colors[b["theme"]]
    im=Image.new("RGB",(1200,630),bg)
    with Image.open(dist/b["gallery"][b["hero"]-1]["src"]) as photo:
        photo=ImageOps.contain(photo,(470,550))
        im.paste(photo,(700+(470-photo.width)//2,(630-photo.height)//2))
    draw=ImageDraw.Draw(im)
    fontdir=Path("C:/Windows/Fonts")
    def font(name,size):
        try:return ImageFont.truetype(str(fontdir/name),size)
        except OSError:return ImageFont.load_default(size=size)
    draw.text((60,65),"HANDMADE IN LEBANON",fill=ink,font=font("segoeui.ttf",20))
    words=b["name"].split(); lines=[];line=""
    for word in words:
        test=(line+" "+word).strip()
        if draw.textlength(test,font=font("georgia.ttf",66))>610:lines.append(line);line=word
        else:line=test
    lines.append(line)
    y=180
    for line in lines:draw.text((60,y),line,fill=ink,font=font("georgia.ttf",66));y+=83
    draw.text((60,485),b["location"],fill=ink,font=font("segoeui.ttf",24))
    draw.text((60,550),"Explore the work. Start a conversation.",fill=ink,font=font("segoeui.ttf",22))
    im.save(dist/"assets"/"social-card.jpg",quality=90,optimize=True)

BAG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>'
PAGES=[("index.html","Home"),("collection.html","Collection"),("gallery.html","Gallery"),("about.html","Our story"),("contact.html","Contact")]
def header(b,page):
    links="".join('<a href="%s"%s>%s</a>'%(f,' aria-current="page"' if f==page else '',label) for f,label in PAGES)
    return f'''<a class="skip" href="#main">Skip to content</a>
<div class="ribbon">HANDMADE IN LEBANON &nbsp; · &nbsp; EXPLORE THE WORK. START A CONVERSATION.</div>
<header class="header"><div class="wrap nav">
<a class="brand" href="index.html" aria-label="{esc(b['name'])} home"><img src="assets/logo.jpg" alt="" width="48" height="48"><span class="brand-name">{esc(b['name'])}<small>Handmade in Lebanon</small></span></a>
<nav class="nav-links" id="nav-links" aria-label="Main navigation">{links}</nav>
<button class="icon-button" type="button" data-open-picks aria-label="Open my picks, 0 selected">{BAG}<span class="picks-label">My picks</span><span class="count" data-picks-count>0</span></button>
<button type="button" class="icon-button menu-toggle" id="menu-toggle" aria-controls="nav-links" aria-expanded="false">Menu</button>
</div></header><noscript><p class="noscript wrap">You can browse the photographs and contact the makers directly. Enable JavaScript for search, photo details and saved picks.</p></noscript>'''

def footer(b):
    email=f'<li><a href="mailto:{esc(b["email"])}">Email the makers</a></li>' if b["email"] else ""
    return f'''<footer class="footer"><div class="wrap"><div class="footer-grid">
<div><a class="footer-brand" href="index.html">{esc(b['name'])}</a><p>Handmade pieces, little details, and a conversation with the people who make them.</p><p>{esc(b['location'])}, Lebanon</p></div>
<div><h3>Take a look</h3><ul><li><a href="collection.html">Explore the collection</a></li><li><a href="gallery.html">Photo journal</a></li><li><a href="about.html">Meet the makers</a></li><li><a href="contact.html">Start an enquiry</a></li></ul></div>
<div><h3>Keep in touch</h3><ul><li><a href="{b['instagram']}" target="_blank" rel="noopener noreferrer">Instagram ↗</a></li><li><a href="tel:{b['phone']}">{b['phone_display']}</a></li>{email}<li><a href="{b['map']}" target="_blank" rel="noopener noreferrer">Location ↗</a></li></ul></div></div>
<div class="footer-bottom"><p>Independent website preview. Photos show portfolio examples; confirm prices and availability directly.</p><a href="#main" class="back-to-top">Back to top ↑</a></div></div></footer>'''

def dialogs(b):
    return f'''<dialog id="product-dialog" class="product-dialog" aria-labelledby="piece-title"><button type="button" class="dialog-close" data-close aria-label="Close piece details">×</button>
<div class="product-content"><div class="product-images"><img id="piece-image" src="{b['pieces'][0]['images'][0]}" alt="" width="480" height="640"><div class="thumbs" id="piece-thumbs"></div></div>
<div class="product-info"><span id="piece-category" class="eyebrow"></span><h2 id="piece-title">Piece details</h2><p id="piece-description"></p>
<form id="piece-form"><div class="preference-fields"><div class="field"><label for="piece-colour">Preferred colour</label><input id="piece-colour" maxlength="100" placeholder="e.g. warm neutrals"></div><div class="field"><label for="piece-size">Preferred size</label><input id="piece-size" maxlength="100" placeholder="Your dimensions or idea"></div>
<div class="field"><label for="piece-qty">Quantity to ask about</label><input id="piece-qty" type="number" min="1" max="20" value="1" required></div><div class="field"><label for="piece-notes">Notes (optional)</label><textarea id="piece-notes" maxlength="500" placeholder="Which detail caught your eye?"></textarea></div></div>
<button class="btn" type="submit">Add to my picks <span aria-hidden="true">+</span></button></form>
<p class="small">A photo reference, not a stock listing. Preferences are requests for discussion. Current options, price and timing are confirmed by the maker.</p><p class="small"><a id="piece-share" href="collection.html">Link to this photo reference ↗</a></p></div></div></dialog>
<dialog id="picks-dialog" class="drawer" aria-labelledby="picks-title"><div class="drawer-head"><h2 id="picks-title">Your little collection</h2><button class="dialog-close" type="button" data-close aria-label="Close my picks">×</button><p class="small">Photo references for your next conversation.</p></div><div class="drawer-body">
<div id="picks-empty" class="empty"><h3>What catches your eye?</h3><p class="small">Explore a piece and add it here. Your picks stay in this browser.</p><button class="btn" id="continue-browsing" type="button">Keep exploring</button></div><ul class="picks-list" id="picks-list"></ul>
<div class="picks-footer" id="picks-footer" hidden><p class="small">No payment is taken here. Review your request with the maker to confirm details.</p><a class="btn" id="picks-whatsapp" href="https://wa.me/{b['phone'][1:]}" target="_blank" rel="noopener noreferrer">Open WhatsApp draft ↗</a><button class="btn secondary" type="button" id="picks-copy">Copy my request</button><a class="btn secondary" href="contact.html">Add a personal message</a><p class="small">If this number is unavailable on WhatsApp, copy your request and <a href="{b['instagram']}" target="_blank" rel="noopener noreferrer">message on Instagram</a> or <a href="tel:{b['phone']}">call the maker</a>.</p><button class="reset" type="button" id="clear-picks">Clear all picks</button></div></div></dialog>
<dialog class="gallery-dialog" id="gallery-dialog" aria-labelledby="lightbox-caption"><button type="button" class="dialog-close" data-close aria-label="Close photograph">×</button><figure class="lightbox-figure"><img id="lightbox-image" src="{b['gallery'][0]['src']}" alt="" width="1200" height="800"><figcaption id="lightbox-caption">Photo details</figcaption></figure><div class="lightbox-controls"><button class="icon-button" type="button" id="gallery-prev" aria-label="Previous photograph">← Previous</button><span id="lightbox-count" aria-live="polite"></span><button class="icon-button" type="button" id="gallery-next" aria-label="Next photograph">Next →</button></div></dialog>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div><textarea id="copy-fallback" aria-label="Request to copy" class="visually-hidden" hidden></textarea>'''

def card(b,p):
    return f'''<article class="card" data-card="{p['id']}"><div class="card-image"><button type="button" data-piece="{p['id']}" aria-label="View {esc(p['title'])}">{image_tag(b,p['index'])}</button><button class="card-quick" type="button" data-piece="{p['id']}" aria-label="Choose {esc(p['title'])}">+</button></div><p class="card-category">{esc(p['category'])}</p><h3><button type="button" data-piece="{p['id']}">{esc(p['title'])}</button></h3><p class="card-tail">Explore & enquire ↗</p></article>'''

def closing(b):
    return f'''<section class="section"><div class="wrap closing"><h2>{b['closing']}</h2><div><p>{b['closing_text']}</p><div class="actions"><a class="btn light" href="contact.html">Start a conversation ↗</a></div></div></div></section>'''

def steps():
    return '''<div class="steps"><div class="step"><span class="step-num">01</span><h3>Find a little inspiration</h3><p>Browse the photographs and open a piece to see the details.</p></div><div class="step"><span class="step-num">02</span><h3>Make a note of your favourites</h3><p>Add photo references to your picks, with your preferred colours, sizes or ideas.</p></div><div class="step"><span class="step-num">03</span><h3>Talk to the maker</h3><p>Share your request and confirm the current options, price, timing and delivery.</p></div></div>'''

def home(b):
    strip = ["Made by hand","From "+b["location"],"Enquire directly"]
    featured = b["pieces"][:4]
    return f'''<div class="wrap"><section class="hero hero-{b['theme']}"><div class="hero-copy"><span class="eyebrow">{b['eyebrow']}</span><h1>{b['headline']}</h1><p class="lede">{b['intro']}</p><div class="actions"><a class="btn" href="collection.html">Explore the collection <span aria-hidden="true">↗</span></a><a class="btn secondary" href="contact.html">Share an idea</a></div><p class="hero-note">Real craft. A direct conversation with the maker.</p></div>
<div class="hero-visual">{image_tag(b,b['hero'],'hero-main',True)}{image_tag(b,b['inset'],'hero-inset')}<span class="hero-decoration">{b['stamp']}</span><span class="photo-tag">{b['tag']}</span></div></section></div>
<div class="strip"><div class="wrap strip-inner">{''.join('<span>'+esc(s)+'</span>' for s in strip)}</div></div>
<section class="section"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">A few things to fall for</span><h2>Little details.<br><em>Lasting impressions.</em></h2></div><a class="text-link" href="collection.html">View the collection</a></div><div class="cards">{''.join(card(b,p) for p in featured)}</div></div></section>
<section class="section soft-section"><div class="wrap story-band"><div>{image_tag(b,b['story'],'story-photo')}</div><div class="story-copy"><span class="eyebrow">{b['story_label']}</span><h2>{b['story_title']}</h2><p class="lede">{b['story_short']}</p><a class="text-link" href="about.html">Read our story</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><div><span class="eyebrow">From browsing to a conversation</span><h2>See something<br>that feels <em>like you?</em></h2></div><p class="small">The photographs are a starting point. The maker can help you explore what comes next.</p></div>{steps()}</div></section>
<div class="wrap"><div class="strip"></div></div>{closing(b)}'''

def intro(title,eyebrow,text):
    return f'''<div class="wrap page-intro"><div class="breadcrumbs"><a href="index.html">Home</a> / {esc(eyebrow)}</div><span class="eyebrow">{eyebrow}</span><h1>{title}</h1><p class="lede">{text}</p></div>'''

def collection(b):
    filters="".join('<button type="button" class="filter" data-filter="%s" aria-pressed="%s">%s</button>'%(esc(c),str(c=="All").lower(),esc(c)) for c in ["All"]+b["categories"])
    return intro("Find your next<br><em>favourite detail.</em>","The collection",b["collection_intro"])+f'''<section class="wrap" style="padding-bottom:70px"><div class="catalogue-tools"><div class="search-row"><div class="field search-field"><label for="collection-search">Search the collection</label><input id="collection-search" type="search" maxlength="100" placeholder="Try a colour, piece or detail…"></div><div class="field sort-field"><label for="collection-sort">Sort by</label><select id="collection-sort"><option value="featured">Featured order</option><option value="az">Name: A to Z</option><option value="za">Name: Z to A</option></select></div></div><div class="filter-row" role="group" aria-label="Collection categories">{filters}</div></div>
<div class="catalogue-status"><p id="result-count" aria-live="polite">{len(b['pieces'])} photo collections</p><button type="button" class="reset" data-reset>Reset filters</button></div><div class="cards collection-grid" id="collection-grid">{''.join(card(b,p) for p in b['pieces'])}</div>
<div class="empty" id="collection-empty" hidden><h2>A different kind of search?</h2><p class="small">No photo references match. Try another word or explore every category.</p><button type="button" class="btn secondary" data-reset>Show all pieces</button></div><p class="catalogue-note">These are descriptive labels for pictured work, rather than a live stock catalogue. A photo may show more than one piece. Availability, specifications, price and any customization are confirmed directly with the makers.</p></section>'''+closing(b)

def gallery(b):
    tiles=[]
    for i,p in enumerate(b["gallery"]):
        tiles.append(f'''<figure class="gallery-tile"><button type="button" data-gallery="{i}" aria-label="Open photograph: {esc(p['title'])}">{image_tag(b,i+1)}</button><figcaption>{esc(p['title'])}<span>{i+1:02d} / {len(b['gallery']):02d} ↗</span></figcaption></figure>''')
    return intro("A closer look<br>at the <em>little things.</em>","The photo journal",b["gallery_intro"])+f'<section class="wrap section" style="padding-top:10px"><div class="gallery-grid">{"".join(tiles)}</div></section>'+closing(b)

def about(b):
    return intro(b["story_title"],"Our story","Meet "+esc(b["makers"])+", the hands behind "+esc(b["name"])+".")+f'''<section class="section" style="padding-top:15px"><div class="wrap story-layout"><div>{image_tag(b,b['story'])}</div><div><span class="eyebrow">{b['story_label']}</span><h2>A thread<br>worth <em>following.</em></h2><p>{b['story_long']}</p><p>{b['story_second']}</p><div class="story-details"><p><strong>Made in {esc(b['location'])}, Lebanon.</strong></p><p>{b['visit']}</p></div><div class="actions"><a class="btn" href="collection.html">Explore the work ↗</a><a class="btn secondary" href="{b['instagram']}" target="_blank" rel="noopener noreferrer">Visit Instagram ↗</a></div></div></div></section>
<section class="section soft-section"><div class="wrap"><p class="quote-panel">{b['statement']}</p></div></section><section class="section"><div class="wrap"><span class="eyebrow">A personal way to enquire</span><h2>Begin with<br><em>a little inspiration.</em></h2>{steps()}</div></section>'''+closing(b)

def contact(b):
    email=f'''<div class="contact-card"><h2>Email</h2><p><a href="mailto:{b['email']}">{b['email']}</a></p></div>''' if b["email"] else ""
    options=''.join('<option>'+esc(c)+'</option>' for c in b["categories"])
    return intro("Let’s start with<br><em>your idea.</em>","Get in touch","A piece you love, an occasion coming up, or a corner in need of texture. Tell the makers what you have in mind.")+f'''<section class="wrap contact-layout" style="padding-bottom:65px"><div><div class="contact-card"><h2>Speak to the maker</h2><p>{esc(b['makers'])}</p><p><a href="tel:{b['phone']}">{b['phone_display']}</a></p></div><div class="contact-card"><h2>On Instagram</h2><p><a href="{b['instagram']}" target="_blank" rel="noopener noreferrer">{b['handle']} ↗</a></p><p class="small">Browse the latest posts or send a direct message.</p></div>{email}<div class="contact-card"><h2>Find us</h2><p>{esc(b['address'])}</p><p class="small">{b['visit']}</p><p><a href="{b['map']}" target="_blank" rel="noopener noreferrer">View location ↗</a></p></div></div>
<div class="enquiry-panel"><h2>A little about your idea</h2><p class="small" style="margin-bottom:25px">Create a message draft to review, then open WhatsApp or copy it into Instagram.</p><form id="enquiry-form"><div class="form-grid"><div class="field"><label for="enquiry-name">Your name *</label><input id="enquiry-name" name="name" required maxlength="100" autocomplete="given-name"></div><div class="field"><label for="enquiry-interest">I’m interested in *</label><select id="enquiry-interest" required><option value="">Choose an area</option>{options}<option>My saved picks</option><option>A custom idea</option><option>Something else</option></select></div><div class="field full"><label for="enquiry-area">Delivery area (optional)</label><input id="enquiry-area" maxlength="100" placeholder="Town or area in Lebanon" autocomplete="address-level2"></div><div class="field full"><label for="enquiry-message">What do you have in mind? *</label><textarea id="enquiry-message" required minlength="10" maxlength="2000" rows="5" placeholder="Tell us about a colour, size, occasion or piece you liked…"></textarea></div><label class="small full"><input type="checkbox" id="include-picks" checked> Include my saved photo references</label></div><button type="submit" class="btn" style="margin-top:24px">Prepare my enquiry ↗</button><p class="form-note">Nothing is sent by this form. Your name and message stay on this page until you choose to share them.</p></form>
<div class="draft-result" id="draft-result" hidden><h3>Your message, ready to review</h3><p class="small">The draft has not been sent. Review it below, then choose where to continue.</p><label class="visually-hidden" for="enquiry-draft">Your enquiry draft</label><textarea id="enquiry-draft" readonly></textarea><div class="actions"><a class="btn" id="enquiry-whatsapp" href="https://wa.me/{b['phone'][1:]}" target="_blank" rel="noopener noreferrer">Open WhatsApp draft ↗</a><button type="button" class="btn secondary" id="enquiry-copy">Copy message</button></div><p class="form-note">If the number is unavailable on WhatsApp, copy the draft and <a href="{b['instagram']}" target="_blank" rel="noopener noreferrer">message on Instagram</a>, or call the number above.</p></div></div></section>
<section class="section soft-section"><div class="wrap faq"><span class="eyebrow">A few helpful details</span><h2>Before you <em>enquire.</em></h2><details><summary>How do I ask about a piece?</summary><p>Open a photo in the collection, add your preferences and save it to My picks. You can copy a request, open a WhatsApp draft or use the contact form to put your idea into words.</p></details><details><summary>Where are the prices and available sizes?</summary><p>The photos show portfolio examples. Ask the makers for the current price, sizing, materials and availability for the specific piece you have in mind.</p></details><details><summary>Can I request a different colour or a custom piece?</summary><p>You can describe your preferences in an enquiry. The makers will confirm which changes are possible, along with any price and timing details.</p></details><details><summary>What about delivery?</summary><p>Include your town or area in your message. Confirm current delivery coverage, fees and timing directly before placing an order.</p></details><details><summary>Can I visit?</summary><p>{b['visit']}</p></details></div></section>
<section class="wrap privacy" style="padding-top:45px"><h2>Your privacy</h2><p>Your saved picks use this browser’s local storage. You can clear them in My picks. This preview uses no analytics, advertising cookies or contact-form server. WhatsApp, Instagram and Maps have their own privacy policies when you open them.</p></section>'''

WEB_CONFIG='''<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <defaultDocument enabled="true"><files><remove value="index.html" /><add value="index.html" /></files></defaultDocument>
    <directoryBrowse enabled="false" />
    <staticContent><clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="00:30:00" /></staticContent>
    <httpProtocol><customHeaders>
      <remove name="X-Content-Type-Options" /><add name="X-Content-Type-Options" value="nosniff" />
      <remove name="Referrer-Policy" /><add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
      <remove name="X-Robots-Tag" /><add name="X-Robots-Tag" value="noindex, nofollow" />
    </customHeaders></httpProtocol>
  </system.webServer>
</configuration>
'''
DESCRIPTIONS={
    "index.html":"Handmade craft in Lebanon. Explore real portfolio photographs and enquire directly with the makers.",
    "collection.html":"Browse pictured pieces, filter the collection and save photo references for a personal enquiry.",
    "gallery.html":"Explore the textures, details and real photographs behind the handmade work.",
    "about.html":"Meet the makers and discover the story behind the handmade work.",
    "contact.html":"Contact the makers, ask about current options and prepare a personal enquiry."
}
def build():
    for b in BUSINESSES:
        if SELECTED_SLUG and b["slug"] != SELECTED_SLUG:
            continue
        dist=prepare(b)
        version=hashlib.sha256((SOURCE/"site.js").read_bytes()+(SOURCE/"site.css").read_bytes()+(dist/"catalogue.js").read_bytes()).hexdigest()[:10]
        bodies=[home,collection,gallery,about,contact]
        for (page,label),body_fn in zip(PAGES,bodies):
            doc=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(b['name'])} — {label if page!='index.html' else 'Handmade in Lebanon'}</title>
<meta name="description" content="{esc(b['name']+'. '+DESCRIPTIONS[page])}">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f6f1e9">
<meta property="og:title" content="{esc(b['name'])} — {label}"><meta property="og:description" content="{esc(DESCRIPTIONS[page])}"><meta property="og:type" content="website">
<!-- PUBLIC_URL_START --><!-- PUBLIC_URL_END -->
<link rel="icon" href="assets/logo.jpg" type="image/jpeg"><link rel="stylesheet" href="site.css?v={version}">
<script src="catalogue.js?v={version}" defer></script><script src="site.js?v={version}" defer></script>
</head><body data-theme="{b['theme']}" class="theme-{b['theme']}">{header(b,page)}
<main id="main">{body_fn(b)}</main>{footer(b)}{dialogs(b)}</body></html>'''
            (dist/page).write_text(doc,encoding="utf-8")
        (dist/"web.config").write_text(WEB_CONFIG,encoding="utf-8")
        (dist/"robots.txt").write_text("User-agent: *\nDisallow: /\n",encoding="utf-8")
        notes=f"""{b['name']} — independent website demo
Prepared for IIS. Open dist/index.html through a local HTTP server or IIS.

Public domain selected by the user: {b['domain']}
IIS site name: {b['iis']}
IIS physical path: <extracted root>\\{b['slug']}\\dist
Private server preview: http://127.0.0.1:{b['port']}/
Five pages: home, collection, gallery, story, contact.

Business: {b['makers']} — {b['location']}, Lebanon.
Public phone: {b['phone_display']}
Instagram: {b['instagram']}
No prices, inventory, payment processing or delivery promises are invented.
Photo labels describe pictured work; they are not verified official product names.
WhatsApp links derive from the public phone. WhatsApp availability was not verified.
The enquiry form prepares a message locally; it does not send or store contact details.
Saved picks persist in this browser only and can be cleared.

Research date: 28 October 2026. Research and source URLs are in research/{b['slug']}.
No matching standalone website was found in the bounded screen; absence is not
owner-confirmed. The business has not approved this demo or image republication.
Obtain business approval and current details before public business launch.
Preview is marked noindex in HTML, robots.txt and web.config. Before an approved
public launch, remove all THREE noindex mechanisms and set public URLs.
Use only the actual dist contents as the IIS web root, not the whole source folder.
See START-HERE.txt and deployment/README.txt for complete IIS steps.
"""
        site_root=ROOT if STANDALONE else ROOT/b["slug"]
        (site_root/"BUSINESS-NOTES.txt").write_text(notes,encoding="utf-8")
        print(b["name"]+": "+str(len(b["pieces"]))+" photo collections, "+str(len(b["gallery"]))+" gallery photographs, 5 pages")
    (ROOT/"source"/"sites.json").write_text(json.dumps([{k:b[k] for k in ["slug","name","domain","iis","port","phone","instagram"]} for b in BUSINESSES],indent=2),encoding="utf-8")

if __name__=="__main__":build()
