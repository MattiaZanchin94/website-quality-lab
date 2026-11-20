using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Controlli SEO di base, "passivi": leggono l'&lt;head&gt; e la struttura della pagina come farebbe
/// un motore di ricerca o un social, e verificano che ci siano le informazioni essenziali perché la
/// pagina sia indicizzata e mostrata correttamente. Non modificano nulla sul sito.
/// </summary>
[TestFixture]
[Category("Regression")]
[AllureFeature("SEO")]
[AllureLabel(FeatureEn, "SEO")]
[AllureSeverity(Major)]
public class SeoTests : QualityLabTest
{
    // Pagine pubbliche di contenuto su cui verifichiamo la SEO, con la lingua attesa dell'attributo <html lang>.
    // È l'unico punto da aggiornare quando cambiano le pagine da controllare.
    private static readonly (string Path, string Lang, string NameIt, string NameEn)[] Pages =
    [
        ("/", "it", "Home", "Home"),
        ("/software-testing/", "it", "Software testing", "Software testing"),
        ("/origini/", "it", "Origini", "Origins"),
        ("/carriera/", "it", "Carriera", "Career"),
    ];

    private static IEnumerable<TestCaseData> PageCases() =>
        Pages.Select(p => new TestCaseData(p.Path, p.Lang));

    private void SetMetadataFor(string path, string nameIt, string nameEn)
    {
        var page = Pages.First(p => p.Path == path);
        AllureApi.SetTestName(string.Format(nameIt, page.NameIt));
        SetEnglishName(string.Format(nameEn, page.NameEn));
        AllureApi.AddLabel("order", (Array.FindIndex(Pages, p => p.Path == path) + 1).ToString());
    }

    /// <summary>
    /// Apre la pagina e aspetta che sia davvero pronta (titolo con almeno un carattere), con retry.
    /// Dopo il controllo anti-bot di SiteGround la home vera arriva con un piccolo ritardo: senza questa
    /// attesa leggeremmo l'&lt;head&gt; a metà caricamento. Se invece resta bloccata su un CAPTCHA, il test
    /// viene ignorato (non fallito), coerentemente con il resto della suite.
    /// </summary>
    private async Task OpenSettledAsync(string path)
    {
        await OpenAsync(BaseUrl + path);
        try
        {
            await Expect(Page).ToHaveTitleAsync(new Regex(@"\S"), new() { Timeout = 15_000 });
        }
        catch (Exception ex) when (ex is PlaywrightException or TimeoutException)
        {
            // Se siamo fermi sulla protezione anti-bot, questo ignora il test con il motivo;
            // altrimenti (titolo davvero assente) rilancia e il test fallisce, com'è giusto.
            await SkipIfBlockedByBotProtectionAsync();
            throw;
        }
    }

    /// <summary>Contenuto di un meta/attributo se l'elemento esiste, altrimenti null (senza far fallire la ricerca).</summary>
    private async Task<string?> AttrOrNullAsync(string selector, string attribute = "content")
    {
        var locator = Page.Locator(selector);
        return await locator.CountAsync() > 0 ? await locator.First.GetAttributeAsync(attribute) : null;
    }

    [TestCaseSource(nameof(PageCases))]
    [AllureDescription("Verifica title, lingua, meta description, canonical, un solo H1 visibile e che la pagina sia indicizzabile.")]
    // Spiegazione ⓘ per i visitatori della Playground.
    [AllureLabel(ExplainWhat, "Controlla che la pagina dia ai motori di ricerca le informazioni di base: titolo, lingua, descrizione, indirizzo canonico, un solo titolo principale (H1) e che sia indicizzabile.")]
    [AllureLabel(ExplainWhy, "Sono le fondamenta della SEO: senza, Google fatica a capire, mostrare e indicizzare correttamente la pagina nei risultati di ricerca.")]
    [AllureLabel(ExplainWhatEn, "Checks that the page gives search engines the basics: title, language, description, canonical URL, a single main heading (H1) and that it is indexable.")]
    [AllureLabel(ExplainWhyEn, "These are the SEO fundamentals: without them, Google struggles to understand, display and index the page correctly in search results.")]
    public async Task PageHasEssentialSeoTags(string path, string expectedLang)
    {
        SetMetadataFor(path, "La pagina «{0}» ha i tag SEO essenziali", "The “{0}” page has the essential SEO tags");

        // Apre la pagina e verifica già il punto 1: il <title> è presente e non vuoto
        // (è ciò che il motore mostra come link nei risultati di ricerca).
        await OpenSettledAsync(path);

        // 2) Lingua dichiarata: <html lang="it..."> (serve a motori e lettori di schermo).
        var htmlLang = await AttrOrNullAsync("html", "lang");
        Assert.That(htmlLang, Does.StartWith(expectedLang).IgnoreCase,
            $"L'attributo lang di <html> è «{htmlLang}», atteso che inizi con «{expectedLang}».");

        // 3) Meta description: presente e non vuota (è il riassunto mostrato sotto il link nei risultati).
        var description = (await AttrOrNullAsync("meta[name=\"description\"]"))?.Trim();
        Assert.That(description, Is.Not.Null.And.Not.Empty, "Manca la meta description.");

        // 4) Canonical: presente e assoluta sul dominio del sito (evita i contenuti duplicati).
        var canonical = await AttrOrNullAsync("link[rel=\"canonical\"]", "href");
        Assert.That(canonical, Is.Not.Null.And.Not.Empty, "Manca il link rel=canonical.");
        Assert.That(canonical, Does.StartWith(BaseUrl),
            $"Il canonical «{canonical}» non punta al dominio del sito ({BaseUrl}).");

        // 5) Un solo H1 visibile: i motori si aspettano un unico titolo principale per pagina.
        var visibleH1 = await Page.GetByRole(AriaRole.Heading, new() { Level = 1 })
            .Filter(new() { Visible = true }).CountAsync();
        Assert.That(visibleH1, Is.EqualTo(1), $"La pagina ha {visibleH1} H1 visibili, atteso esattamente 1.");

        // 6) Indicizzabile: se c'è un meta robots, non deve contenere "noindex".
        var robots = (await AttrOrNullAsync("meta[name=\"robots\"]"))?.ToLowerInvariant() ?? "";
        Assert.That(robots, Does.Not.Contain("noindex"),
            "La pagina è marcata noindex: i motori non la indicizzeranno.");
    }

    [TestCaseSource(nameof(PageCases))]
    [AllureDescription("Verifica i tag Open Graph (og:title, og:description, og:url, og:image) usati per l'anteprima quando il link viene condiviso sui social.")]
    // Spiegazione ⓘ per i visitatori della Playground.
    [AllureLabel(ExplainWhat, "Controlla i tag Open Graph (titolo, descrizione, indirizzo e immagine) che definiscono l'anteprima del link quando viene condiviso.")]
    [AllureLabel(ExplainWhy, "Quando il link viene condiviso su LinkedIn, Facebook o WhatsApp, questi tag decidono titolo, testo e immagine dell'anteprima: senza, l'anteprima è povera o sbagliata.")]
    [AllureLabel(ExplainWhatEn, "Checks the Open Graph tags (title, description, URL and image) that define the link's preview when it is shared.")]
    [AllureLabel(ExplainWhyEn, "When the link is shared on LinkedIn, Facebook or WhatsApp, these tags set the preview's title, text and image: without them the preview looks poor or wrong.")]
    public async Task PageHasSocialPreviewTags(string path, string expectedLang)
    {
        SetMetadataFor(path, "La pagina «{0}» ha l'anteprima social (Open Graph)",
            "The “{0}” page has social preview tags (Open Graph)");

        await OpenSettledAsync(path);

        // I tag Open Graph decidono come appare il link quando viene condiviso (LinkedIn, Facebook, ecc.).
        var ogTitle = (await AttrOrNullAsync("meta[property=\"og:title\"]"))?.Trim();
        var ogDescription = (await AttrOrNullAsync("meta[property=\"og:description\"]"))?.Trim();
        var ogUrl = await AttrOrNullAsync("meta[property=\"og:url\"]");
        var ogImage = await AttrOrNullAsync("meta[property=\"og:image\"]");

        Assert.That(ogTitle, Is.Not.Null.And.Not.Empty, "Manca og:title (titolo dell'anteprima social).");
        Assert.That(ogDescription, Is.Not.Null.And.Not.Empty, "Manca og:description (testo dell'anteprima social).");
        Assert.That(ogUrl, Does.StartWith(BaseUrl), $"og:url «{ogUrl}» non punta al dominio del sito ({BaseUrl}).");
        Assert.That(ogImage, Is.Not.Null.And.Not.Empty, "Manca og:image (immagine dell'anteprima social).");
    }
}
