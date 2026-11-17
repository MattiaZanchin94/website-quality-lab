using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using Microsoft.Playwright.TestAdapter;
using NUnit.Framework.Interfaces;
using NUnit.Framework.Internal;

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

    /// <summary>Identificativo stabile del test (classe, metodo e dati), uguale su tutti i browser.</summary>
    protected static string TestKey => TestContext.CurrentContext.Test.FullName;

    [SetUp]
    public async Task TagBrowser()
    {
        // Il browser diventa un parametro del test: in Allure lo stesso test su
        // più browser risulta come esecuzioni distinte, ognuna con il suo storico.
        AllureApi.AddTestParameter("Browser", ActualBrowser);
        AllureApi.AddLabel("browser", ActualBrowser);
        // La chiave serve alla pagina Playground per collegare l'avanzamento in diretta ai risultati.
        AllureApi.AddLabel("test_key", TestKey);

        await LiveProgress.ReportAsync(ActualBrowser, TestKey, "running");
    }

    // Il CAPTCHA può comparire in qualsiasi momento, non solo all'apertura della pagina
    // (es. la home si carica e qualche secondo dopo SiteGround reindirizza alla verifica).
    // Osserviamo quindi ogni cambio di pagina per tutta la durata del test.
    private bool _blockedByCaptcha;

    [SetUp]
    public void WatchForBotProtection()
    {
        _blockedByCaptcha = false;
        Page.FrameNavigated += (_, frame) =>
        {
            if (frame == Page.MainFrame && Captcha.IsMatch(frame.Url)) _blockedByCaptcha = true;
        };
    }

    [TearDown]
    public async Task FinishTest()
    {
        MarkBlockedTestsAsNotVerifiable();
        await LiveProgress.ReportAsync(ActualBrowser, TestKey, LiveStatus());
    }

    // Esito per l'avanzamento in diretta, dopo l'eventuale correzione per il CAPTCHA.
    private static string LiveStatus() =>
        TestExecutionContext.CurrentContext.CurrentResult.ResultState.Status switch
        {
            TestStatus.Passed => "passed",
            TestStatus.Skipped => "skipped",
            _ => "failed",
        };

    private void MarkBlockedTestsAsNotVerifiable()
    {
        // Se il test è fallito mentre (o dopo che) l'hosting mostrava un CAPTCHA, non è un errore del sito:
        // trasformiamo l'esito in "ignorato", con il motivo. Assert.Ignore qui non basterebbe
        // (NUnit terrebbe il fallimento): modifichiamo il risultato attraverso il contesto di esecuzione.
        var result = TestExecutionContext.CurrentContext.CurrentResult;
        var blocked = _blockedByCaptcha || Captcha.IsMatch(Page.Url) || AutomaticCheck.IsMatch(Page.Url);
        if (blocked && result.ResultState.Status == TestStatus.Failed)
        {
            result.SetResult(ResultState.Ignored,
                $"Non verificabile: la protezione anti-bot dell'hosting ha mostrato un CAPTCHA ({ActualBrowser}).");
        }
    }

    // ---------------------------------------------------------------------
    // Contenuto visibile della pagina
    // ---------------------------------------------------------------------

    /// <summary>
    /// Verifica che la pagina mostri davvero il suo contenuto, come lo vede il visitatore:
    /// il titolo principale (H1) visibile con il testo atteso e un'area di testo non vuota.
    /// Indirizzo e titolo della scheda non bastano: WordPress li genera anche per una pagina vuota.
    /// </summary>
    /// <param name="heading">Testo atteso dell'H1 (maiuscole/minuscole ignorate: il tema le cambia con il CSS).</param>
    /// <param name="content">Area del testo; se non indicata, l'area principale della pagina (main).</param>
    /// <param name="minChars">Quanti caratteri di testo deve contenere almeno l'area.</param>
    protected async Task ExpectPageShowsContentAsync(string heading, ILocator? content = null, int minChars = 200)
    {
        var h1 = Page.GetByRole(AriaRole.Heading, new() { Level = 1 }).Filter(new() { Visible = true }).First;
        await Expect(h1).ToHaveTextAsync(heading, new() { IgnoreCase = true });

        var area = content ?? Page.GetByRole(AriaRole.Main);
        await Expect(area).ToBeVisibleAsync();
        // Expect riprova finché il testo arriva: utile anche per i contenuti caricati via JavaScript.
        await Expect(area).ToHaveTextAsync(new Regex($@"^[\s\S]{{{minChars},}}$"));
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
