using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using Microsoft.Playwright.TestAdapter;

namespace QualityLab.Tests;

/// <summary>
/// Classe base di tutti i test: ciò che è comune sta qui, una volta sola.
/// Le classi di test ereditano da QualityLabTest invece che direttamente da PageTest.
/// </summary>
[AllureNUnit]
[AllureEpic("mattiazanchin.com")]
public abstract class QualityLabTest : PageTest
{
    protected const string BaseUrl = "https://mattiazanchin.com";

    // Nomi in inglese per la versione /en/ del sito, salvati come label Allure.
    // Si usano con [AllureLabel(NameEn, "...")] su un test o [AllureLabel(FeatureEn, "...")] su una classe.
    protected const string NameEn = "name_en";
    protected const string FeatureEn = "feature_en";

    // Priorità dei controlli. Allure non ha un livello "major": usiamo il suo "normal"
    // e la pagina Playground lo mostra come Major.
    protected const SeverityLevel Blocker = SeverityLevel.blocker; // se fallisce, il sito ha un problema serio
    protected const SeverityLevel Major = SeverityLevel.normal;    // importante, ma non blocca l'uso del sito

    /// <summary>Nome inglese impostato a runtime, per i test generati dai dati.</summary>
    protected static void SetEnglishName(string name) => AllureApi.AddLabel(NameEn, name);

    // BrowserName (ereditato da PlaywrightTest) vale chromium, firefox o webkit:
    // si sceglie con la variabile d'ambiente BROWSER, es. BROWSER=firefox dotnet test.
    // Edge è Chromium con un "channel" diverso, impostato dalla riga di comando:
    //   dotnet test -- Playwright.LaunchOptions.Channel=msedge

    /// <summary>Il browser reale: chromium, firefox, webkit oppure msedge.</summary>
    protected string ActualBrowser =>
        PlaywrightSettingsProvider.LaunchOptions?.Channel is { Length: > 0 } channel ? channel : BrowserName;

    [SetUp]
    public void TagBrowser()
    {
        // Il browser diventa un parametro del test: in Allure lo stesso test su
        // più browser risulta come esecuzioni distinte, ognuna con il suo storico.
        AllureApi.AddTestParameter("Browser", ActualBrowser);
        AllureApi.AddLabel("browser", ActualBrowser);
    }

    // ---------------------------------------------------------------------
    // Protezione anti-bot dell'hosting (SiteGround)
    // ---------------------------------------------------------------------
    // A volte SiteGround non mostra la pagina ma una verifica anti-bot:
    //   /.well-known/sgcaptcha/  → controllo automatico in JavaScript, poi carica il sito vero
    //   /.well-known/captcha/    → CAPTCHA da risolvere a mano: il test non può (e non deve) superarlo
    // Nel secondo caso il controllo non è "fallito" ma "non verificabile": lo segniamo come ignorato,
    // con il motivo, così un vero problema del sito resta rosso e un blocco dell'ambiente no.

    private static readonly Regex AutomaticCheck = new(@"/\.well-known/sgcaptcha/", RegexOptions.Compiled);
    private static readonly Regex Captcha = new(@"/\.well-known/captcha/", RegexOptions.Compiled);

    /// <summary>Apre una pagina e ignora il test se l'hosting mostra un CAPTCHA.</summary>
    protected async Task<IResponse?> OpenAsync(string url)
    {
        var response = await Page.GotoAsync(url);
        await SkipIfBlockedByBotProtectionAsync();
        return response;
    }

    /// <summary>
    /// Da chiamare dopo ogni azione che cambia pagina (es. un clic su un link).
    /// Aspetta la fine del controllo automatico; se poi compare un CAPTCHA, ignora il test.
    /// </summary>
    protected async Task SkipIfBlockedByBotProtectionAsync()
    {
        if (AutomaticCheck.IsMatch(Page.Url))
        {
            try
            {
                // Di solito dopo qualche secondo la verifica automatica porta alla pagina vera.
                await Page.WaitForURLAsync(url => !AutomaticCheck.IsMatch(url), new() { Timeout = 15_000 });
            }
            catch (TimeoutException)
            {
                // Rimasti bloccati sulla verifica: lo gestisce il controllo qui sotto.
            }
        }

        if (Captcha.IsMatch(Page.Url) || AutomaticCheck.IsMatch(Page.Url))
        {
            Assert.Ignore($"Non verificabile: la protezione anti-bot dell'hosting ha mostrato un CAPTCHA ({ActualBrowser}).");
        }
    }
}
