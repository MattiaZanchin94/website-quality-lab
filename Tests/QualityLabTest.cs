using System.Diagnostics.CodeAnalysis;
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

    // Spiegazione per i visitatori del Playground (finestra ⓘ accanto al controllo), in parole semplici:
    // cosa fa il controllo e perché conta. Facoltativa: senza, il Playground non mostra l'icona.
    protected const string ExplainWhat = "explain_what";
    protected const string ExplainWhy = "explain_why";
    protected const string ExplainWhatEn = "explain_what_en";
    protected const string ExplainWhyEn = "explain_why_en";
    // "Come sistemare": azione concreta quando il controllo non è verde (mostrata nella pagina riservata).
    protected const string ExplainFix = "explain_fix";
    protected const string ExplainFixEn = "explain_fix_en";

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

    // ---------------------------------------------------------------------
    // Dispositivi emulati (smartphone e tablet)
    // ---------------------------------------------------------------------
    // Con QLP_DEVICE=iphone|android|ipad|fold|ipadland i test girano con dimensioni dello schermo, touch e
    // "carta d'identità" del browser di quel dispositivo. È un'emulazione: il motore è quello
    // del browser indicato da BROWSER (WebKit per iPhone e iPad, Chromium per Android), non un telefono vero.
    private static readonly Dictionary<string, string> Devices = new()
    {
        ["iphone"] = "iPhone 15",
        ["android"] = "Pixel 7",
        ["ipad"] = "iPad Pro 11",
        ["fold"] = "Galaxy Z Fold 7 Cover",       // pieghevole chiuso: 360 px, il telefono più stretto
        ["ipadland"] = "iPad Pro 11 landscape",   // tablet in orizzontale: 1194 px
    };

    /// <summary>Dispositivo emulato (iphone, android, ipad, fold, ipadland) oppure null per il desktop.</summary>
    protected static string? Device =>
        Environment.GetEnvironmentVariable("QLP_DEVICE") is { Length: > 0 } d && Devices.ContainsKey(d) ? d : null;

    /// <summary>True su smartphone e tablet emulati, dove il menu del sito è "a panino".</summary>
    protected static bool IsMobileDevice => Device is not null;

    public override BrowserNewContextOptions ContextOptions() =>
        Device is { } d ? Playwright.Devices[Devices[d]] : base.ContextOptions();

    /// <summary>Il "browser" del risultato: chromium, msedge, firefox, webkit oppure un dispositivo emulato.</summary>
    protected string ActualBrowser =>
        Device ?? (PlaywrightSettingsProvider.LaunchOptions?.Channel is { Length: > 0 } channel ? channel : BrowserName);

    /// <summary>Identificativo stabile del test (classe, metodo e dati), uguale su tutti i browser.</summary>
    protected static string TestKey => TestContext.CurrentContext.Test.FullName;

    // Il CAPTCHA può comparire in qualsiasi momento, non solo all'apertura della pagina
    // (es. la home si carica e qualche secondo dopo SiteGround reindirizza alla verifica).
    // Osserviamo quindi ogni cambio di pagina per tutta la durata del test.
    private bool _blockedByCaptcha;

    // Quando l'hosting blocca questa macchina con un CAPTCHA, di solito lo fa per tutta l'esecuzione:
    // i controlli successivi di questo browser vengono saltati subito, invece di aspettare ognuno il timeout.
    // È "static" perché vale per tutti i test del processo (un processo = un browser su GitHub Actions).
    private static bool _hostBlockedThisBrowser;

    // Un solo [SetUp]: con più metodi nella stessa classe NUnit non garantisce l'ordine.
    [SetUp]
    public async Task StartTest()
    {
        // Il browser diventa un parametro del test: in Allure lo stesso test su
        // più browser risulta come esecuzioni distinte, ognuna con il suo storico.
        AllureApi.AddTestParameter("Browser", ActualBrowser);
        AllureApi.AddLabel("browser", ActualBrowser);
        // La chiave serve alla pagina Playground per collegare l'avanzamento in diretta ai risultati.
        AllureApi.AddLabel("test_key", TestKey);

        if (_hostBlockedThisBrowser)
        {
            BlockedByAntiBot($"l'hosting ha già bloccato questo browser con la verifica anti-bot ({ActualBrowser}).");
        }

        _blockedByCaptcha = false;
        Page.FrameNavigated += (_, frame) =>
        {
            if (frame == Page.MainFrame && Captcha.IsMatch(frame.Url)) _blockedByCaptcha = true;
        };

        await HandleCookieBannerAsync();

        await LiveProgress.ReportAsync(ActualBrowser, TestKey, "running");
    }

    // ---------------------------------------------------------------------
    // Banner dei cookie e Google Analytics
    // ---------------------------------------------------------------------
    // Il sito mostra un banner per il consenso ai cookie (GDPR). Il test si comporta come
    // un visitatore attento alla privacy: quando il banner compare e copre la pagina, lo rifiuta.
    // Gli invii di dati a Google Analytics vengono comunque bloccati, così le esecuzioni
    // automatiche (ogni ora, su nove browser) non finiscono nelle statistiche delle visite.
    // Lo script di Google (gtag.js) invece si carica: serve al controllo sulla privacy,
    // che verifica che senza consenso non imposti cookie.

    // Solo gli indirizzi che ricevono i dati delle visite, non quello che fornisce lo script.
    private static readonly Regex AnalyticsHits =
        new(@"^https?://([^/]+\.)?(google-analytics\.com|analytics\.google\.com)/", RegexOptions.Compiled);

    // Testo del pulsante "rifiuta" nei banner più comuni, in italiano e in inglese.
    private static readonly Regex RejectCookies =
        new(@"^\s*(rifiuta|nega|solo (i cookie )?necessari|deny|reject|decline|only necessary)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private ILocator? _rejectButton;

    /// <summary>Invii a Google Analytics tentati durante il test (e bloccati), con il loro indirizzo completo.</summary>
    protected List<string> BlockedAnalyticsHits { get; private set; } = [];

    private async Task HandleCookieBannerAsync()
    {
        // NUnit riusa la stessa istanza per i test di una classe: la lista riparte vuota a ogni test.
        var hits = BlockedAnalyticsHits = [];
        await Context.RouteAsync(AnalyticsHits, route =>
        {
            hits.Add(route.Request.Url);
            return route.AbortAsync();
        });

        // Playwright chiama questo gestore ogni volta che il banner è visibile prima di un'azione
        // (clic, attesa, verifica): funziona anche se il banner compare qualche secondo dopo.
        _rejectButton = Page.GetByRole(AriaRole.Button, new() { NameRegex = RejectCookies }).Filter(new() { Visible = true }).First;
        await Page.AddLocatorHandlerAsync(_rejectButton, button => button.ClickAsync());
    }

    /// <summary>
    /// Smette di rifiutare il banner in automatico: per i test che devono vederlo e sceglierlo da sé.
    /// Va chiamato prima di aprire la pagina.
    /// </summary>
    protected async Task LetTestHandleCookieBannerAsync()
    {
        if (_rejectButton is not null) await Page.RemoveLocatorHandlerAsync(_rejectButton);
    }

    [TearDown]
    public async Task FinishTest()
    {
        var blockedNow = FailedBecauseOfAntiBot();
        await LiveProgress.ReportAsync(ActualBrowser, TestKey, blockedNow || IsAntiBotResult() ? "skipped" : LiveStatus());
        // Se il test è fallito mentre (o dopo che) l'hosting mostrava la verifica anti-bot, non è un errore
        // del sito: lo trasformiamo in Broken lanciando l'eccezione dedicata (Allure registra come Broken
        // le eccezioni del TearDown; cambiare il risultato a mano non basterebbe).
        if (blockedNow) BlockedByAntiBot($"la protezione anti-bot dell'hosting ha mostrato un CAPTCHA durante il controllo ({ActualBrowser}).");
    }

    // Esito per l'avanzamento in diretta.
    private static string LiveStatus() =>
        TestExecutionContext.CurrentContext.CurrentResult.ResultState.Status switch
        {
            TestStatus.Passed => "passed",
            TestStatus.Skipped => "skipped",
            _ => "failed",
        };

    private static bool IsAntiBotResult() =>
        TestExecutionContext.CurrentContext.CurrentResult.Message?.Contains(AntiBotPrefix) == true;

    private bool FailedBecauseOfAntiBot()
    {
        var result = TestExecutionContext.CurrentContext.CurrentResult;
        var blocked = _blockedByCaptcha || Captcha.IsMatch(Page.Url) || AutomaticCheck.IsMatch(Page.Url);
        return blocked && result.ResultState.Status == TestStatus.Failed && !IsAntiBotResult();
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
    // Alle richieste HTTP dirette può invece rispondere con 202 Accepted e l'header «SG-Captcha: challenge»
    // al posto della risorsa. In tutti questi casi il requisito NON è stato verificato:
    //   requisito soddisfatto → Passed · non soddisfatto → Failed · verifica impedita dall'anti-bot → Broken.
    // Il Broken porta l'etichetta Allure «antibot»: Playground e dashboard lo mostrano come «non verificabile»
    // (giallo), non come un problema del sito.

    /// <summary>Etichetta Allure dei controlli bloccati dall'anti-bot (letta da scripts/summary.mjs).</summary>
    public const string AntiBotLabel = "antibot";
    private const string AntiBotPrefix = "Non verificabile:";

    /// <summary>Segna il controllo come bloccato dall'anti-bot: Broken in Allure, «non verificabile» nelle pagine.</summary>
    [DoesNotReturn]
    protected static void BlockedByAntiBot(string detail)
    {
        _hostBlockedThisBrowser = true; // i prossimi controlli di questo browser vengono segnati subito
        AllureApi.AddLabel(AntiBotLabel, "blocked");
        throw new AntiBotBlockedException($"{AntiBotPrefix} {detail}");
    }

    /// <summary>True se il server ha risposto con la sfida anti-bot (202 Accepted + header SG-Captcha).</summary>
    public static bool IsAntiBotChallenge(int status, IReadOnlyDictionary<string, string> headers) =>
        status == 202 && headers.Keys.Any(k => k.Equals("sg-captcha", StringComparison.OrdinalIgnoreCase));

    /// <summary>Per le richieste HTTP dirette: se la risposta è la sfida anti-bot, il controllo diventa Broken.</summary>
    protected static void ThrowIfAntiBot(IAPIResponse response, string url)
    {
        if (IsAntiBotChallenge(response.Status, response.Headers))
            BlockedByAntiBot($"l'anti-bot dell'hosting ha risposto 202 con SG-Captcha al posto di {url}.");
    }

    private static readonly Regex AutomaticCheck = new(@"/\.well-known/sgcaptcha/", RegexOptions.Compiled);
    private static readonly Regex Captcha = new(@"/\.well-known/captcha/", RegexOptions.Compiled);

    /// <summary>
    /// Apre una pagina e ignora il test se l'hosting mostra un CAPTCHA.
    /// Se la connessione cade prima che il server risponda (errore di rete, non del sito),
    /// riprova fino a 2 volte: un sito davvero irraggiungibile fa comunque fallire il test.
    /// </summary>
    protected async Task<IResponse?> OpenAsync(string url)
    {
        const int attempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var response = await Page.GotoAsync(url);
                if (response is not null && IsAntiBotChallenge(response.Status, response.Headers))
                    BlockedByAntiBot($"l'anti-bot dell'hosting ha risposto 202 con SG-Captcha ({ActualBrowser}).");
                await SkipIfBlockedByBotProtectionAsync();
                return response;
            }
            catch (PlaywrightException ex) when (attempt < attempts && DroppedConnection.IsMatch(ex.Message))
            {
                await Task.Delay(TimeSpan.FromSeconds(2 * attempt));
            }
        }
    }

    // Errori di trasporto che i browser danno quando la connessione si interrompe a metà
    // (es. "HTTP/2 Error: NO_ERROR" di WebKit quando il server chiude il canale HTTP/2).
    // Non comprendono gli errori che indicano un sito giù, come DNS o connessione rifiutata.
    private static readonly Regex DroppedConnection = new(
        @"HTTP/2 Error|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_HTTP2_PROTOCOL_ERROR|ERR_EMPTY_RESPONSE|NS_ERROR_NET_RESET|NS_ERROR_NET_INTERRUPT|network connection was lost",
        RegexOptions.Compiled);

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
            BlockedByAntiBot($"la protezione anti-bot dell'hosting ha mostrato un CAPTCHA ({ActualBrowser}).");
    }

    // ---------------------------------------------------------------------
    // Richieste HTTP resilienti (per i controlli via APIRequest)
    // ---------------------------------------------------------------------
    // L'anti-bot dell'hosting, dagli IP dei data center, a volte chiude la connessione
    // (ECONNRESET / "socket hang up") o risponde con una pagina di sfida al posto della risorsa.
    // Non è un problema del sito: ritentiamo e, se insiste, il controllo diventa Broken («non verificabile»).
    private static readonly Regex DroppedByHost = new(
        @"socket hang up|ECONNRESET|ECONNREFUSED|socket disconnected|network socket disconnected|read ECONN|EPIPE",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BotWall = new(
        @"\.well-known/(sg)?captcha|Robot Challenge", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    protected static async Task<IAPIResponse> GetResilientAsync(
        IAPIRequestContext http, string url, APIRequestContextOptions? options = null)
    {
        const int attempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var response = await http.GetAsync(url, options);
                ThrowIfAntiBot(response, url); // 202 + SG-Captcha: verifica impedita → Broken
                return response;
            }
            catch (PlaywrightException ex) when (attempt < attempts && DroppedByHost.IsMatch(ex.Message))
            {
                await Task.Delay(TimeSpan.FromSeconds(2 * attempt));
            }
            catch (PlaywrightException ex) when (DroppedByHost.IsMatch(ex.Message))
            {
                BlockedByAntiBot($"la protezione anti-bot dell'hosting ha chiuso la connessione ({url}).");
            }
        }
    }

    /// <summary>Se la risposta è la pagina di sfida anti-bot, il controllo diventa Broken («non verificabile»).</summary>
    protected static void SkipIfBotWall(string body)
    {
        if (BotWall.IsMatch(body))
            BlockedByAntiBot("la protezione anti-bot dell'hosting ha risposto al posto della risorsa.");
    }
}


/// <summary>Verifica impedita dalla protezione anti-bot dell'hosting: Allure la registra come Broken.</summary>
public sealed class AntiBotBlockedException(string message) : Exception(message);
