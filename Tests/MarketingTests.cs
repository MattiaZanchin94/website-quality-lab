using System.Text.RegularExpressions;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

// Controlli di MARKETING, campetto Marketing della Playground. Taggati [Category("Marketing")]: girano solo
// su Chromium (stesso risultato su ogni browser) e nel summary.json hanno area = marketing.
// Una copia identica vive nel repo privato (categoria MarketingDeep) per la dashboard riservata.
// Domanda di fondo: i dati delle visite sono affidabili, le campagne si misurano, chi arriva
// trova subito come contattarti e il brand appare bene quando viene condiviso?
// Gli invii a Google Analytics vengono sempre bloccati (QualityLabTest): i test leggono cosa
// il sito PROVA a mandare, senza sporcare le statistiche.

/// <summary>Helper comuni: cattura degli invii a Google Analytics 4 e accettazione del banner.</summary>
public abstract class MarketingBase : SeoDeepBase
{
    // Invii di GA4 (endpoint /g/collect), non lo script gtag.js.
    private static readonly Regex Ga4Collect = new(
        @"^https?://([^/]+\.)?(google-analytics\.com|analytics\.google\.com)/g/collect", RegexOptions.Compiled);

    /// <summary>Invii a GA4 catturati: URL + corpo (GA4 a volte raggruppa più eventi nel corpo della richiesta).</summary>
    protected List<string> Hits { get; } = [];

    /// <summary>Da chiamare prima di aprire le pagine: registra ogni invio a GA4 (che resta comunque bloccato).</summary>
    protected void CaptureAnalytics()
    {
        Hits.Clear();
        Page.Request += (_, req) =>
        {
            if (Ga4Collect.IsMatch(req.Url))
            {
                lock (Hits) Hits.Add(req.Url + "\n" + (req.PostData ?? ""));
            }
        };
    }

    /// <summary>Aspetta che arrivino almeno <paramref name="count"/> invii (max 15 s), poi ancora un attimo.</summary>
    protected async Task WaitForHitsAsync(int count = 1)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (Hits.Count < count && DateTime.UtcNow < deadline) await Page.WaitForTimeoutAsync(250);
        await Page.WaitForTimeoutAsync(1_500);
    }

    protected List<string> SnapshotHits()
    {
        lock (Hits) return [.. Hits];
    }

    /// <summary>ID di misurazione GA4 (G-XXXX) presenti negli invii.</summary>
    protected static HashSet<string> MeasurementIds(IEnumerable<string> hits) =>
        hits.SelectMany(h => Regex.Matches(h, @"[?&]tid=(G-[A-Z0-9]+)").Select(m => m.Groups[1].Value)).ToHashSet();

    /// <summary>Quante volte l'evento compare negli invii (in URL o nel corpo raggruppato).</summary>
    protected static int CountEvent(IEnumerable<string> hits, string name) =>
        hits.Sum(h => Regex.Matches(h, $@"(^|[?&\n])en={Regex.Escape(name)}(&|\s|$)").Count);

    /// <summary>Apre la home come visitatore nuovo e accetta i cookie dal banner.</summary>
    protected async Task OpenAndAcceptCookiesAsync(string path = "/")
    {
        await LetTestHandleCookieBannerAsync();
        await OpenSettledAsync(path);
        var accept = Page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex(@"^\s*(accetta|accept)", RegexOptions.IgnoreCase) })
            .Filter(new() { Visible = true }).First;
        await Expect(accept).ToBeVisibleAsync(new() { Timeout = 15_000 });
        await accept.ClickAsync();
        await Expect(accept).ToBeHiddenAsync();
    }
}

/// <summary>Misurazione: Google Analytics installato bene, consenso, eventi e campagne.</summary>
[TestFixture]
[Category("Marketing")]
[AllureFeature("Misurazione")]
[AllureLabel(FeatureEn, "Measurement")]
[AllureSeverity(Major)]
public class MarketingMeasurementTests : MarketingBase
{
    [Category("Smoke")]
    [AllureSeverity(Blocker)]
    [Test]
    [AllureName("Google Analytics 4 è attivo su tutte le pagine chiave")]
    [AllureLabel(NameEn, "Google Analytics 4 is active on all key pages")]
    [AllureLabel("order", "1")]
    [AllureLabel(ExplainWhat, "Apre le pagine chiave e verifica che ognuna provi a inviare dati a Google Analytics 4 con un ID di misurazione (G-…).")]
    [AllureLabel(ExplainWhy, "Una pagina senza Analytics è una pagina che non esiste nei report: le visite spariscono e le decisioni di marketing si basano su numeri incompleti. Succede spesso dopo un cambio di tema o di template.")]
    [AllureLabel(ExplainWhatEn, "Opens the key pages and checks each one tries to send data to Google Analytics 4 with a measurement ID (G-…).")]
    [AllureLabel(ExplainWhyEn, "A page without Analytics doesn't exist in the reports: visits disappear and marketing decisions rest on incomplete numbers. It often happens after a theme or template change.")]
    [AllureLabel(ExplainFix, "Collega Google Analytics in un punto solo che valga per tutto il sito (Complianz → Integrazioni, oppure Site Kit o il plugin GA usato) e non dentro un singolo template o una singola pagina.")]
    [AllureLabel(ExplainFixEn, "Connect Google Analytics in one place that covers the whole site (Complianz → Integrations, or Site Kit / your GA plugin), not inside a single template or page.")]
    public async Task Ga4IsActiveOnKeyPages()
    {
        CaptureAnalytics();
        var missing = new List<string>();
        foreach (var p in Pages)
        {
            Hits.Clear();
            await OpenSettledAsync(p.Path);
            await WaitForHitsAsync();
            if (MeasurementIds(SnapshotHits()).Count == 0) missing.Add(p.NameIt);
        }
        Assert.That(missing, Is.Empty, "Nessun invio a Google Analytics 4 su: " + string.Join(", ", missing));
    }

    [Category("Regression")]
    [Test]
    [AllureName("Un solo Google Analytics per pagina (nessun doppio conteggio)")]
    [AllureLabel(NameEn, "A single Google Analytics per page (no double counting)")]
    [AllureLabel("order", "2")]
    [AllureLabel(ExplainWhat, "Su ogni pagina chiave conta gli ID di misurazione GA4 usati, gli script gtag.js caricati e le page_view inviate: devono essere uno.")]
    [AllureLabel(ExplainWhy, "Due installazioni (es. plugin + codice incollato nel tema) contano ogni visita due volte: le visualizzazioni raddoppiano, la frequenza di rimbalzo crolla e i report non sono più credibili.")]
    [AllureLabel(ExplainWhatEn, "On each key page counts the GA4 measurement IDs used, the gtag.js scripts loaded and the page_views sent: each must be one.")]
    [AllureLabel(ExplainWhyEn, "Two installs (e.g. plugin + code pasted in the theme) count every visit twice: views double, bounce rate collapses and the reports stop being credible.")]
    [AllureLabel(ExplainFix, "Tieni una sola installazione: se Analytics arriva da Complianz o da un plugin, togli il codice gtag incollato a mano nel tema (header.php, «Codice personalizzato») o in Google Tag Manager.")]
    [AllureLabel(ExplainFixEn, "Keep a single install: if Analytics comes from Complianz or a plugin, remove the gtag code pasted by hand in the theme (header.php, “Custom code”) or in Google Tag Manager.")]
    public async Task OnlyOneAnalyticsPerPage()
    {
        CaptureAnalytics();
        var problems = new List<string>();
        foreach (var p in Pages)
        {
            Hits.Clear();
            await OpenSettledAsync(p.Path);
            await WaitForHitsAsync();
            var hits = SnapshotHits();
            var ids = MeasurementIds(hits);
            var scripts = await Page.Locator("script[src*=\"googletagmanager.com/gtag/js\"]").CountAsync();
            var views = CountEvent(hits, "page_view");
            if (ids.Count > 1) problems.Add($"{p.NameIt}: {ids.Count} ID diversi ({string.Join(", ", ids)})");
            if (scripts > 1) problems.Add($"{p.NameIt}: gtag.js caricato {scripts} volte");
            if (views > 1) problems.Add($"{p.NameIt}: {views} page_view per una sola visita");
        }
        Assert.That(problems, Is.Empty, string.Join("\n", problems));
    }

    [Category("Regression")]
    [Test]
    [AllureName("Google Consent Mode v2 è attivo")]
    [AllureLabel(NameEn, "Google Consent Mode v2 is active")]
    [AllureLabel("order", "3")]
    [AllureLabel(ExplainWhat, "Prima della scelta sui cookie verifica che gli invii a Google contengano i segnali di Consent Mode v2 (parametri gcs e gcd) con le statistiche negate.")]
    [AllureLabel(ExplainWhy, "Dal 2024 Google chiede Consent Mode v2 a chi usa i suoi servizi in Europa: senza, Analytics e Google Ads perdono i dati dei visitatori europei e il remarketing smette di funzionare. Con v2 Google stima anche le visite di chi rifiuta.")]
    [AllureLabel(ExplainWhatEn, "Before the cookie choice checks that hits to Google carry the Consent Mode v2 signals (gcs and gcd parameters) with statistics denied.")]
    [AllureLabel(ExplainWhyEn, "Since 2024 Google requires Consent Mode v2 for its services in Europe: without it, Analytics and Google Ads lose EU visitors' data and remarketing stops working. With v2 Google also models visits from people who decline.")]
    [AllureLabel(ExplainFix, "In Complianz → Integrazioni → Statistiche, scegli Google Analytics con «Consent Mode v2» attivo (o abilitalo in Google Tag Manager → Impostazioni consenso).")]
    [AllureLabel(ExplainFixEn, "In Complianz → Integrations → Statistics, pick Google Analytics with “Consent Mode v2” on (or enable it in Google Tag Manager → Consent settings).")]
    public async Task ConsentModeV2IsActive()
    {
        await LetTestHandleCookieBannerAsync(); // nessuna scelta: il banner resta aperto
        CaptureAnalytics();
        await OpenSettledAsync("/");
        await WaitForHitsAsync();
        var hits = SnapshotHits();

        Assert.That(hits, Is.Not.Empty, "Nessun invio a Google prima della scelta: Consent Mode non manda i segnali senza cookie.");
        Assert.Multiple(() =>
        {
            Assert.That(hits.Where(h => !Regex.IsMatch(h, @"[?&]gcd=")), Is.Empty,
                "Invii senza il parametro gcd: Consent Mode è alla versione 1 o non è configurato.");
            Assert.That(hits.Where(h => !Regex.IsMatch(h, @"[?&]gcs=G1\d0")), Is.Empty,
                "Invii senza consenso negato alle statistiche (gcs=G1?0) prima della scelta.");
        });
    }

    [Category("Smoke")]
    [AllureSeverity(Blocker)]
    [Test]
    [AllureName("Dopo il consenso le visite vengono misurate")]
    [AllureLabel(NameEn, "After consent, visits are measured")]
    [AllureLabel("order", "4")]
    [AllureLabel(ExplainWhat, "Accetta i cookie dal banner, apre un'altra pagina e verifica che Google Analytics riceva una page_view con il consenso alle statistiche concesso (gcs=G1?1).")]
    [AllureLabel(ExplainWhy, "Un banner configurato male può bloccare Analytics anche dopo un «Accetta»: il sito sembra a posto, ma i report restano vuoti proprio per chi ha detto sì.")]
    [AllureLabel(ExplainWhatEn, "Accepts cookies in the banner, opens another page and checks Google Analytics receives a page_view with statistics consent granted (gcs=G1?1).")]
    [AllureLabel(ExplainWhyEn, "A misconfigured banner can keep Analytics blocked even after “Accept”: the site looks fine, but reports stay empty precisely for people who said yes.")]
    [AllureLabel(ExplainFix, "In Complianz controlla che Google Analytics sia nella categoria «Statistiche» e che, dopo il consenso, lo script non resti bloccato (Complianz → Integrazioni → Script center).")]
    [AllureLabel(ExplainFixEn, "In Complianz check Google Analytics is in the “Statistics” category and that the script isn't still blocked after consent (Complianz → Integrations → Script center).")]
    public async Task VisitsAreMeasuredAfterConsent()
    {
        await OpenAndAcceptCookiesAsync("/");
        CaptureAnalytics();
        await OpenSettledAsync("/carriera/");
        await WaitForHitsAsync();
        var granted = SnapshotHits().Where(h => Regex.IsMatch(h, @"[?&]gcs=G1\d1")).ToList();

        Assert.That(granted, Is.Not.Empty, "Dopo «Accetta» nessun invio a Google con il consenso alle statistiche.");
        Assert.That(CountEvent(granted, "page_view"), Is.GreaterThanOrEqualTo(1),
            "Dopo «Accetta» Google riceve dati, ma nessuna page_view.");
    }

    [Category("Regression")]
    [Test]
    [AllureName("I parametri UTM delle campagne arrivano ad Analytics")]
    [AllureLabel(NameEn, "Campaign UTM parameters reach Analytics")]
    [AllureLabel("order", "5")]
    [AllureLabel(ExplainWhat, "Apre un link di campagna con utm_source, utm_medium e utm_campaign (con un redirect di mezzo, come succede spesso) e verifica che i parametri restino nell'indirizzo e arrivino a Google Analytics.")]
    [AllureLabel(ExplainWhy, "Se un redirect o un plugin di cache toglie gli UTM, le visite da newsletter, social e annunci finiscono in «Direct»: non sai più quale campagna funziona e quale è budget sprecato.")]
    [AllureLabel(ExplainWhatEn, "Opens a campaign link with utm_source, utm_medium and utm_campaign (through a redirect, as often happens) and checks the parameters stay in the address and reach Google Analytics.")]
    [AllureLabel(ExplainWhyEn, "If a redirect or a cache plugin strips UTMs, visits from newsletters, social and ads end up as “Direct”: you can no longer tell which campaign works and which is wasted budget.")]
    [AllureLabel(ExplainFix, "Controlla i redirect (SiteGround, .htaccess, plugin Redirection): devono conservare la query string. In SiteGround Speed Optimizer escludi i parametri utm_* da eventuali regole che ripuliscono l'URL.")]
    [AllureLabel(ExplainFixEn, "Check the redirects (SiteGround, .htaccess, Redirection plugin): they must keep the query string. In SiteGround Speed Optimizer exclude utm_* parameters from any URL-cleaning rule.")]
    public async Task UtmParametersReachAnalytics()
    {
        const string utm = "utm_source=quality-lab&utm_medium=test&utm_campaign=verifica";
        CaptureAnalytics();
        // Senza la barra finale: WordPress reindirizza a /carriera/, come capita con molti link condivisi.
        await OpenSettledAsync("/carriera?" + utm);
        await WaitForHitsAsync();

        Assert.That(Page.Url, Does.Contain("utm_source=quality-lab").And.Contain("utm_campaign=verifica"),
            $"Dopo il redirect l'indirizzo ha perso gli UTM: {Page.Url}");

        var withUtm = SnapshotHits().Where(h =>
            Regex.Match(h, @"[?&]dl=([^&\s]+)") is { Success: true } m &&
            Uri.UnescapeDataString(m.Groups[1].Value).Contains("utm_source=quality-lab")).ToList();
        Assert.That(withUtm, Is.Not.Empty, "Google Analytics non riceve gli UTM nell'indirizzo della pagina (parametro dl).");
    }
}

/// <summary>Contatti e brand: chi arriva trova come contattarti e riconosce il brand, anche da un link sbagliato.</summary>
[TestFixture]
[Category("Marketing")]
[AllureFeature("Contatti e brand")]
[AllureLabel(FeatureEn, "Contacts and brand")]
[AllureSeverity(Major)]
public class MarketingContactBrandTests : MarketingBase
{
    // Nome del brand che deve comparire nel titolo di ogni pagina (risultati di Google, schede, condivisioni).
    private const string Brand = "Mattia Zanchin";

    private static readonly Regex ContactHref = new(
        @"^(mailto:|tel:)|linkedin\.com/in/|/contatt|/contact|wa\.me/|calendly\.com/", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [Category("Smoke")]
    [AllureSeverity(Blocker)]
    [Test]
    [AllureName("Da ogni pagina chiave si trova come contattarti")]
    [AllureLabel(NameEn, "Every key page shows how to contact you")]
    [AllureLabel("order", "6")]
    [AllureLabel(ExplainWhat, "Su ogni pagina chiave cerca almeno un contatto cliccabile: email, telefono, profilo LinkedIn, pagina contatti, WhatsApp o prenotazione di una call. Gli indirizzi email devono essere validi.")]
    [AllureLabel(ExplainWhy, "Chi arriva da Google o da un post spesso atterra su una pagina interna, non sulla home: se lì non trova come contattarti, il contatto è perso. È la conversione più importante di un sito personale o professionale.")]
    [AllureLabel(ExplainWhatEn, "On each key page looks for at least one clickable contact: email, phone, LinkedIn profile, contact page, WhatsApp or call booking. Email addresses must be valid.")]
    [AllureLabel(ExplainWhyEn, "People arriving from Google or a post often land on an inner page, not the home: if they can't find how to reach you there, the lead is lost. It's the key conversion for a personal or professional site.")]
    [AllureLabel(ExplainFix, "Aggiungi i contatti nel footer o nell'header del tema (Aspetto → Editor del sito → Footer), così compaiono su tutte le pagine; per l'email usa un link mailto: con un indirizzo completo.")]
    [AllureLabel(ExplainFixEn, "Add contacts in the theme footer or header (Appearance → Site Editor → Footer) so they appear on every page; for email use a mailto: link with a full address.")]
    public async Task EveryKeyPageShowsContacts()
    {
        var problems = new List<string>();
        foreach (var p in Pages)
        {
            await OpenSettledAsync(p.Path);
            var hrefs = await Page.Locator("a[href]").EvaluateAllAsync<string[]>("els => els.map(e => e.getAttribute('href') || '')");
            var contacts = hrefs.Where(h => ContactHref.IsMatch(h)).ToList();
            if (contacts.Count == 0) problems.Add($"{p.NameIt}: nessun contatto cliccabile");
            foreach (var mail in contacts.Where(h => h.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)))
            {
                var address = Uri.UnescapeDataString(mail[7..].Split('?')[0]);
                if (!Regex.IsMatch(address, @"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", RegexOptions.IgnoreCase))
                    problems.Add($"{p.NameIt}: email non valida «{address}»");
            }
        }
        Assert.That(problems.Distinct(), Is.Empty, string.Join("\n", problems.Distinct()));
    }

    [Category("Regression")]
    [Test]
    [AllureName("Il brand compare nel titolo di ogni pagina")]
    [AllureLabel(NameEn, "The brand appears in every page title")]
    [AllureLabel("order", "8")]
    [AllureLabel(ExplainWhat, $"Verifica che il titolo di ogni pagina chiave (quello che Google mostra nei risultati e il browser nella scheda) contenga «{Brand}».")]
    [AllureLabel(ExplainWhy, "Il nome nel titolo fa riconoscere il brand a colpo d'occhio nei risultati di ricerca e nelle schede aperte: chi ti cerca per nome ti trova subito, e chi ti ha già visto ti riconosce.")]
    [AllureLabel(ExplainWhatEn, $"Checks that every key page's title (shown by Google in results and by the browser in the tab) contains “{Brand}”.")]
    [AllureLabel(ExplainWhyEn, "The name in the title makes the brand recognisable at a glance in search results and open tabs: people searching for you find you straight away, and those who've seen you recognise you.")]
    [AllureLabel(ExplainFix, "In All in One SEO → Aspetto della ricerca → Generale, usa un modello di titolo come «#post_title #separator_sa #site_title» e controlla che il titolo del sito sia «Mattia Zanchin». Se una pagina ha un titolo SEO personalizzato, aggiungi il nome anche lì.")]
    [AllureLabel(ExplainFixEn, "In All in One SEO → Search Appearance → General, use a title template like “#post_title #separator_sa #site_title” and make sure the site title is “Mattia Zanchin”. If a page has a custom SEO title, add the name there too.")]
    public async Task BrandAppearsInEveryTitle()
    {
        var missing = new List<string>();
        foreach (var p in Pages)
        {
            await OpenSettledAsync(p.Path);
            var title = await Page.TitleAsync();
            if (!title.Contains(Brand, StringComparison.OrdinalIgnoreCase)) missing.Add($"{p.NameIt}: «{title}»");
        }
        Assert.That(missing, Is.Empty, $"Titoli senza «{Brand}»:\n" + string.Join("\n", missing));
    }

    [Category("Regression")]
    [Test]
    [AllureName("Un link sbagliato porta a una pagina 404 utile")]
    [AllureLabel(NameEn, "A broken link leads to a helpful 404 page")]
    [AllureLabel("order", "10")]
    [AllureLabel(ExplainWhat, "Apre un indirizzo che non esiste e verifica che il sito risponda con lo stato 404 (non 200) e mostri una pagina con un titolo e un link per tornare alla home.")]
    [AllureLabel(ExplainWhy, "Link con un refuso, campagne vecchie, post condivisi anni fa: prima o poi qualcuno arriva su una pagina che non c'è più. Una 404 utile lo trattiene; una pagina vuota lo fa andare via. Lo stato 404 evita anche che Google indicizzi pagine finte.")]
    [AllureLabel(ExplainWhatEn, "Opens an address that doesn't exist and checks the site answers with status 404 (not 200) and shows a page with a heading and a link back to the home.")]
    [AllureLabel(ExplainWhyEn, "Typo'd links, old campaigns, posts shared years ago: sooner or later someone lands on a page that's gone. A helpful 404 keeps them; a blank page sends them away. The 404 status also stops Google indexing fake pages.")]
    [AllureLabel(ExplainFix, "Personalizza la pagina 404 dal tema (Aspetto → Editor del sito → Modelli → 404) con un messaggio, il menu e un pulsante verso la home. Se risponde 200, disattiva i plugin che reindirizzano tutte le 404 alla home.")]
    [AllureLabel(ExplainFixEn, "Customise the 404 page in the theme (Appearance → Site Editor → Templates → 404) with a message, the menu and a button to the home. If it answers 200, disable plugins that redirect every 404 to the home.")]
    public async Task BrokenLinkShowsHelpful404()
    {
        var response = await OpenAsync(BaseUrl + "/pagina-che-non-esiste-quality-lab/");
        Assert.That(response, Is.Not.Null, "Nessuna risposta dal sito.");
        Assert.That(response!.Status, Is.EqualTo(404), $"Una pagina inesistente risponde {response.Status} invece di 404.");

        var heading = Page.Locator("h1, h2").Filter(new() { Visible = true }).First;
        await Expect(heading).ToBeVisibleAsync(new() { Timeout = 10_000 });

        var homeLinks = await Page.Locator("a[href]").EvaluateAllAsync<int>(
            "(els, base) => els.filter(e => e.offsetParent !== null && [base, base + '/', '/'].includes((e.getAttribute('href') || '').replace(/\\/en\\/?$/, '/'))).length",
            BaseUrl);
        Assert.That(homeLinks, Is.GreaterThan(0), "La pagina 404 non ha un link visibile per tornare alla home.");
    }
}

/// <summary>Anteprime e velocità: come appare il link condiviso e quanto è rapida la pagina da smartphone.</summary>
[TestFixture]
[Category("Marketing")]
[AllureFeature("Anteprime e velocità")]
[AllureLabel(FeatureEn, "Previews and speed")]
[AllureSeverity(Major)]
public class MarketingPreviewSpeedTests : MarketingBase
{
    // Dimensioni consigliate da Facebook e LinkedIn per l'anteprima grande (1200 × 627/630).
    private const int MinWidth = 1200;
    private const int MinHeight = 600;

    [Category("Regression")]
    [Test]
    [AllureName("L'immagine di anteprima social funziona su ogni pagina")]
    [AllureLabel(NameEn, "The social preview image works on every page")]
    [AllureLabel("order", "7")]
    [AllureLabel(ExplainWhat, "Per ogni pagina chiave apre l'immagine indicata in og:image e verifica che si carichi davvero e sia grande almeno 1200 × 600 pixel.")]
    [AllureLabel(ExplainWhy, "Il tag og:image può esserci ma puntare a un'immagine cancellata o troppo piccola: LinkedIn e Facebook allora mostrano un riquadro grigio o una miniatura minuscola, e il post riceve molti meno clic.")]
    [AllureLabel(ExplainWhatEn, "For each key page opens the og:image picture and checks it really loads and is at least 1200 × 600 pixels.")]
    [AllureLabel(ExplainWhyEn, "The og:image tag can be there but point to a deleted or tiny image: LinkedIn and Facebook then show a grey box or a small thumbnail, and the post gets far fewer clicks.")]
    [AllureLabel(ExplainFix, "In All in One SEO → Social Networks imposta un'immagine predefinita di 1200 × 630 px, e per le pagine importanti scegline una dedicata nella scheda «Social» della pagina. Poi rigenera l'anteprima con il Post Inspector di LinkedIn.")]
    [AllureLabel(ExplainFixEn, "In All in One SEO → Social Networks set a 1200 × 630 px default image, and pick a dedicated one for important pages in the page's “Social” tab. Then refresh the preview with LinkedIn's Post Inspector.")]
    public async Task SocialPreviewImageWorks()
    {
        var problems = new List<string>();
        foreach (var p in Pages)
        {
            await OpenSettledAsync(p.Path);
            var src = await AttrOrNullAsync("meta[property=\"og:image\"]");
            if (string.IsNullOrWhiteSpace(src)) { problems.Add($"{p.NameIt}: manca og:image"); continue; }

            // Carica l'immagine nella pagina, come farebbe il browser: ne legge le dimensioni reali.
            var size = await Page.EvaluateAsync<int[]>(@"(src) => new Promise((resolve) => {
                const img = new Image();
                const t = setTimeout(() => resolve([0, 0]), 10000);
                img.onload = () => { clearTimeout(t); resolve([img.naturalWidth, img.naturalHeight]); };
                img.onerror = () => { clearTimeout(t); resolve([0, 0]); };
                img.src = src;
            })", src);
            if (size[0] == 0) problems.Add($"{p.NameIt}: l'immagine {src} non si carica");
            else if (size[0] < MinWidth || size[1] < MinHeight) problems.Add($"{p.NameIt}: {size[0]} × {size[1]} px, troppo piccola ({src})");
        }
        Assert.That(problems, Is.Empty, string.Join("\n", problems));
    }

    // Pagine su cui di solito arrivano i link delle campagne.
    private static readonly string[] LandingPages = ["/", "/software-testing/"];

    [Category("Regression")]
    [Test]
    [AllureName("Le pagine di atterraggio sono veloci da smartphone")]
    [AllureLabel(NameEn, "Landing pages are fast on smartphones")]
    [AllureLabel("order", "9")]
    [AllureLabel(ExplainWhat, "Apre le pagine su cui arrivano le campagne (Home e Software testing) con un Android emulato e misura quando compare il contenuto principale (LCP). Soglia: 2,5 secondi.")]
    [AllureLabel(ExplainWhy, "La maggior parte dei clic da social e annunci arriva da smartphone: ogni secondo in più fa perdere visitatori prima ancora che vedano la pagina, e per Google Ads una pagina lenta alza il costo per clic.")]
    [AllureLabel(ExplainWhatEn, "Opens the pages campaigns land on (Home and Software testing) on an emulated Android and measures when the main content appears (LCP). Threshold: 2.5 seconds.")]
    [AllureLabel(ExplainWhyEn, "Most clicks from social and ads come from smartphones: every extra second loses visitors before they even see the page, and for Google Ads a slow page raises the cost per click.")]
    [AllureLabel(ExplainFix, "Comprimi e ridimensiona l'immagine principale in cima alla pagina (WebP, max ~200 KB), escludila dal lazy-load e attiva in SiteGround Speed Optimizer la cache dinamica e la minificazione di CSS e JavaScript.")]
    [AllureLabel(ExplainFixEn, "Compress and resize the main image at the top of the page (WebP, max ~200 KB), exclude it from lazy-load, and enable dynamic caching and CSS/JS minification in SiteGround Speed Optimizer.")]
    public async Task LandingPagesAreFastOnMobile()
    {
        await using var context = await Browser.NewContextAsync(Playwright.Devices["Pixel 7"]);
        // Anche qui gli invii a Google Analytics vengono bloccati: niente visite finte nelle statistiche.
        await context.RouteAsync(new Regex(@"^https?://([^/]+\.)?(google-analytics\.com|analytics\.google\.com)/"), r => r.AbortAsync());
        var page = await context.NewPageAsync();

        var slow = new List<string>();
        foreach (var path in LandingPages)
        {
            await page.GotoAsync(BaseUrl + path);
            if (Regex.IsMatch(page.Url, @"/\.well-known/(sg)?captcha/"))
            {
                try { await page.WaitForURLAsync(u => !u.Contains("/.well-known/"), new() { Timeout = 15_000 }); }
                catch (TimeoutException) { BlockedByAntiBot("la protezione anti-bot dell'hosting ha mostrato un CAPTCHA."); }
            }
            var lcp = await page.EvaluateAsync<double>(@"() => new Promise((resolve) => {
                let v = 0;
                try { new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) v = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
                setTimeout(() => resolve(v), 3500);
            })");
            if (lcp <= 0) Assert.Ignore("LCP non misurabile in questo ambiente.");
            if (lcp >= 2500) slow.Add($"{path}: LCP {lcp:F0} ms");
        }
        Assert.That(slow, Is.Empty, "Pagine lente da smartphone (soglia 2500 ms):\n" + string.Join("\n", slow));
    }
}
