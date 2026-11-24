using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Base dei controlli che girano sulle pagine chiave (Marketing nella Playground; SEO e altri approfonditi nel repo privato). Aggiunge a QualityLabTest gli helper
/// comuni: apertura robusta della pagina, lettura di meta/attributi e l'elenco delle pagine controllate.
/// </summary>
public abstract class SeoDeepBase : QualityLabTest
{
    // Pagine pubbliche di contenuto su cui girano i controlli SEO approfonditi.
    protected static readonly (string Path, string Lang, string NameIt, string NameEn)[] Pages =
    [
        ("/", "it", "Home", "Home"),
        ("/software-testing/", "it", "Software testing", "Software testing"),
        ("/origini/", "it", "Origini", "Origins"),
        ("/carriera/", "it", "Carriera", "Career"),
    ];

    protected static IEnumerable<TestCaseData> PageCases() => Pages.Select(p => new TestCaseData(p.Path));

    protected static (string NameIt, string NameEn) PageInfo(string path)
    {
        var p = Pages.First(x => x.Path == path);
        return (p.NameIt, p.NameEn);
    }

    /// <summary>
    /// Apre la pagina e aspetta che sia pronta (titolo non vuoto). Se resta su un CAPTCHA, il test viene
    /// ignorato (non fallito), coerentemente con il resto della suite.
    /// </summary>
    protected async Task OpenSettledAsync(string path)
    {
        await OpenAsync(BaseUrl + path);
        try
        {
            await Expect(Page).ToHaveTitleAsync(new Regex(@"\S"), new() { Timeout = 15_000 });
        }
        catch (Exception ex) when (ex is PlaywrightException or TimeoutException)
        {
            await SkipIfBlockedByBotProtectionAsync();
            throw;
        }
    }

    /// <summary>Contenuto di un meta/attributo se l'elemento esiste, altrimenti null.</summary>
    protected async Task<string?> AttrOrNullAsync(string selector, string attribute = "content")
    {
        var locator = Page.Locator(selector);
        return await locator.CountAsync() > 0 ? await locator.First.GetAttributeAsync(attribute) : null;
    }

    /// <summary>URL assoluto atteso della pagina (senza query/fragment), per confronti canonical/hreflang.</summary>
    protected static string AbsoluteUrl(string path) => BaseUrl + path;
}
