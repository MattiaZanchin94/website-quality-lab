using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Sicurezza: controlli passivi. Leggono le risposte del sito come farebbe un browser,
/// senza attacchi né scansioni aggressive (su un hosting condiviso non si fa altro).
/// Header, redirect e certificati sono gli stessi per qualsiasi browser:
/// in CI questi controlli girano solo su Chromium (categoria "Security").
/// </summary>
[TestFixture]
[Category("Regression")]
[Category("Security")]
[AllureFeature("Sicurezza")]
[AllureLabel(FeatureEn, "Security")]
public class SecurityTests : QualityLabTest
{
    private const string Canonical = "https://mattiazanchin.com";

    // Indirizzi "non canonici": senza HTTPS, con www o entrambi.
    // Ognuno deve portare alla versione https senza www dello stesso percorso:
    // chi apre un vecchio link a http://…/carriera/ deve arrivare a https://…/carriera/.
    private static readonly string[] NonCanonicalOrigins =
    [
        "http://mattiazanchin.com",
        "http://www.mattiazanchin.com",
        "https://www.mattiazanchin.com",
    ];

    private static readonly string[] Paths = ["/", "/carriera/", "/playground/", "/en/"];

    [Test]
    [AllureName("Il sito usa sempre una connessione sicura")]
    [AllureLabel(NameEn, "The site always uses a secure connection")]
    [AllureDescription("Ogni indirizzo senza HTTPS o con www porta, con un redirect permanente, " +
                       "alla stessa pagina su https://mattiazanchin.com.")]
    [AllureSeverity(Blocker)]
    public async Task SiteAlwaysUsesSecureConnection()
    {
        // Non serve una pagina: usiamo il "client HTTP" di Playwright, che non segue i redirect
        // se glielo chiediamo (MaxRedirects = 0). Così vediamo la prima risposta del server,
        // non solo dove si arriva alla fine.
        await using var http = await Playwright.APIRequest.NewContextAsync();

        var problems = new List<string>();
        foreach (var origin in NonCanonicalOrigins)
        foreach (var path in Paths)
        {
            var start = origin + path;
            var expected = Canonical + path;

            // Seguiamo la catena un passo alla volta. Più passaggi vanno bene
            // (es. http://www → https://www → https://, l'ordine raccomandato: prima si cifra,
            // poi si cambia dominio), purché ogni passaggio sia permanente e porti già su HTTPS.
            var url = start;
            for (var hop = 1; url != expected; hop++)
            {
                if (hop > 3)
                {
                    problems.Add($"{start} → troppi redirect, ultimo indirizzo {url}");
                    break;
                }

                var response = await http.GetAsync(url, new() { MaxRedirects = 0 });
                await SkipIfCaptchaAsync(response);
                var location = response.Headers.GetValueOrDefault("location");

                // 301 e 308 sono redirect "permanenti": browser e Google ricordano il nuovo indirizzo.
                if (response.Status is not (301 or 308))
                {
                    problems.Add($"{url} → risponde {response.Status} invece di un redirect permanente");
                    break;
                }
                if (location is null || !location.StartsWith("https://"))
                {
                    problems.Add($"{url} → porta a {location}, ancora senza HTTPS");
                    break;
                }
                url = location;
            }
        }

        // Elenchiamo tutti gli indirizzi sbagliati in una volta, non solo il primo.
        Assert.That(problems, Is.Empty, "Indirizzi che non passano a HTTPS:\n" + string.Join("\n", problems));
    }

    // ---------------------------------------------------------------------
    // Header di sicurezza
    // ---------------------------------------------------------------------
    // Gli header sono istruzioni che il server manda al browser insieme alla pagina.
    // Li controlliamo su più pagine, in italiano e in inglese: alcune arrivano dalla cache
    // di SiteGround, altre da WordPress, e un header potrebbe mancare solo in uno dei due casi.
    private static readonly string[] HeaderPages = ["/", "/playground/", "/en/", "/category/articoli-tecnici/"];

    // 6 mesi in secondi: il minimo consigliato per HSTS.
    private const long MinHstsSeconds = 60L * 60 * 24 * 182;

    [Test]
    [AllureName("Il browser è obbligato a usare HTTPS")]
    [AllureLabel(NameEn, "Browsers are required to use HTTPS")]
    [AllureDescription("Le pagine inviano l'header Strict-Transport-Security (HSTS) per almeno 6 mesi: " +
                       "dopo la prima visita il browser non apre più il sito senza cifratura, nemmeno da un vecchio link.")]
    [AllureSeverity(Major)]
    public async Task BrowsersAreRequiredToUseHttps()
    {
        await ExpectHeaderOnAllPagesAsync("strict-transport-security", value =>
        {
            // Esempio: "max-age=31536000; includeSubDomains" → prendiamo il numero dopo max-age=.
            var maxAge = Regex.Match(value, @"max-age=(\d+)", RegexOptions.IgnoreCase);
            return maxAge.Success && long.Parse(maxAge.Groups[1].Value) >= MinHstsSeconds;
        }, "max-age di almeno 6 mesi");
    }

    [Test]
    [AllureName("Il sito non può essere inserito in altri siti")]
    [AllureLabel(NameEn, "The site cannot be embedded in other sites")]
    [AllureDescription("Le pagine inviano X-Frame-Options (DENY o SAMEORIGIN): un altro sito non può mostrarle " +
                       "dentro una cornice invisibile per far cliccare il visitatore a sua insaputa (clickjacking).")]
    [AllureSeverity(Major)]
    public async Task SiteCannotBeEmbeddedInOtherSites()
    {
        await ExpectHeaderOnAllPagesAsync("x-frame-options",
            value => value.Trim().ToUpperInvariant() is "DENY" or "SAMEORIGIN",
            "DENY o SAMEORIGIN");
    }

    // Valori di Referrer-Policy che non mandano ad altri siti l'indirizzo completo della pagina.
    private static readonly string[] SafeReferrerPolicies =
        ["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"];

    [Test]
    [AllureName("Il browser riceve le protezioni di base")]
    [AllureLabel(NameEn, "Browsers receive the basic protections")]
    [AllureDescription("Le pagine inviano X-Content-Type-Options: nosniff (il browser non 'indovina' il tipo dei file) " +
                       "e una Referrer-Policy che non comunica ad altri siti l'indirizzo completo della pagina visitata.")]
    [AllureSeverity(Major)]
    public async Task BrowsersReceiveBasicProtections()
    {
        await ExpectHeaderOnAllPagesAsync("x-content-type-options",
            value => value.Trim().Equals("nosniff", StringComparison.OrdinalIgnoreCase),
            "nosniff");
        await ExpectHeaderOnAllPagesAsync("referrer-policy",
            value => SafeReferrerPolicies.Contains(value.Split(',').Last().Trim().ToLowerInvariant()),
            string.Join(" o ", SafeReferrerPolicies));
    }

    /// <summary>
    /// Scarica le pagine di <see cref="HeaderPages"/> e verifica che ognuna abbia l'header indicato
    /// con un valore accettabile. Segnala tutte le pagine sbagliate in una volta.
    /// </summary>
    /// <param name="header">Nome dell'header, in minuscolo (Playwright li restituisce così).</param>
    /// <param name="isValid">Regola per decidere se il valore va bene.</param>
    /// <param name="expected">Descrizione del valore atteso, per il messaggio di errore.</param>
    private async Task ExpectHeaderOnAllPagesAsync(string header, Func<string, bool> isValid, string expected)
    {
        await using var http = await Playwright.APIRequest.NewContextAsync();

        var problems = new List<string>();
        foreach (var path in HeaderPages)
        {
            var response = await http.GetAsync(Canonical + path, new() { MaxRedirects = 0 });
            await SkipIfCaptchaAsync(response);

            var value = response.Headers.GetValueOrDefault(header);
            if (value is null)
                problems.Add($"{path} → header {header} assente");
            else if (!isValid(value))
                problems.Add($"{path} → {header}: \"{value}\" (atteso: {expected})");
        }

        Assert.That(problems, Is.Empty, $"Header {header} non corretto:\n" + string.Join("\n", problems));
    }

    // Let's Encrypt rinnova i certificati 30 giorni prima della scadenza:
    // se ne mancano meno di 14, il rinnovo automatico non sta funzionando.
    private const int MinDaysBeforeExpiry = 14;

    [Test]
    [AllureName("Il certificato di sicurezza è valido")]
    [AllureLabel(NameEn, "The security certificate is valid")]
    [AllureDescription("Il certificato HTTPS di mattiazanchin.com e www.mattiazanchin.com è riconosciuto dai browser, " +
                       "è intestato al sito e non scade nei prossimi 14 giorni.")]
    [AllureSeverity(Blocker)]
    public async Task CertificateIsValid()
    {
        var problems = new List<string>();
        foreach (var host in new[] { "mattiazanchin.com", "www.mattiazanchin.com" })
        {
            var (certificate, errors) = await GetCertificateAsync(host);

            // SslPolicyErrors riassume i controlli che fa anche il browser:
            // emesso da un'autorità riconosciuta, intestato a questo nome, non scaduto.
            if (errors != SslPolicyErrors.None)
                problems.Add($"{host} → certificato non valido ({errors})");

            var daysLeft = (certificate.NotAfter - DateTime.Now).TotalDays;
            if (daysLeft < MinDaysBeforeExpiry)
                problems.Add($"{host} → il certificato scade il {certificate.NotAfter:dd/MM/yyyy} ({daysLeft:0} giorni)");
        }

        Assert.That(problems, Is.Empty, "Problemi con il certificato:\n" + string.Join("\n", problems));
    }

    /// <summary>
    /// Apre una connessione cifrata con il server e restituisce il suo certificato,
    /// insieme agli eventuali errori trovati nella verifica.
    /// Il browser non espone il certificato ai test, .NET sì.
    /// </summary>
    private static async Task<(X509Certificate2 Certificate, SslPolicyErrors Errors)> GetCertificateAsync(string host)
    {
        var errors = SslPolicyErrors.None;
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(host, 443);

        // La "callback" riceve l'esito della verifica: lo salviamo e rispondiamo true
        // (= continua comunque), così possiamo leggere il certificato anche se non è valido
        // e spiegare il motivo, invece di avere solo un'eccezione generica.
        await using var tls = new SslStream(tcp.GetStream(), leaveInnerStreamOpen: false,
            (_, _, _, sslErrors) => { errors = sslErrors; return true; });
        await tls.AuthenticateAsClientAsync(host);

        return (new X509Certificate2(tls.RemoteCertificate!), errors);
    }

    // ---------------------------------------------------------------------
    // Informazioni che WordPress non deve rivelare
    // ---------------------------------------------------------------------

    // Un indirizzo email dentro una risposta: nome@dominio.estensione
    private static readonly Regex Email = new(@"[\w.+-]+@[\w-]+\.[\w.]+", RegexOptions.Compiled);

    [Test]
    [AllureName("L'elenco degli utenti non è pubblico")]
    [AllureLabel(NameEn, "The list of users is not public")]
    [AllureDescription("Chi non ha fatto l'accesso non può leggere i nomi utente di WordPress: l'API degli utenti " +
                       "non risponde, le pagine autore non rivelano il nome e l'anteprima dei link non contiene indirizzi email. " +
                       "Un nome utente noto è metà delle credenziali di accesso.")]
    [AllureSeverity(Blocker)]
    public async Task UserListIsNotPublic()
    {
        await using var http = await Playwright.APIRequest.NewContextAsync();
        var problems = new List<string>();

        // 1. L'API REST di WordPress: di base elenca gli utenti a chiunque.
        foreach (var path in new[] { "/wp-json/wp/v2/users", "/wp-json/wp/v2/users/1" })
        {
            var response = await http.GetAsync(Canonical + path);
            await SkipIfCaptchaAsync(response);
            if (response.Ok)
                problems.Add($"{path} → risponde {response.Status} e mostra gli utenti");
        }

        // 2. ?author=1: WordPress di base porta a /author/<nome-utente>/, rivelandolo nell'indirizzo.
        var author = await http.GetAsync(Canonical + "/?author=1", new() { MaxRedirects = 0 });
        await SkipIfCaptchaAsync(author);
        var location = author.Headers.GetValueOrDefault("location") ?? "";
        if (location.Contains("/author/"))
            problems.Add($"/?author=1 → porta a {location}, che contiene il nome utente");

        // 3. oEmbed: l'anteprima che compare quando qualcuno condivide un link del sito
        //    contiene il nome pubblico dell'autore. Non deve essere un indirizzo email.
        var embed = await http.GetAsync(Canonical + "/wp-json/oembed/1.0/embed?url=" + Uri.EscapeDataString(Canonical + "/"));
        await SkipIfCaptchaAsync(embed);
        if (embed.Ok && Email.IsMatch(await embed.TextAsync()))
            problems.Add("/wp-json/oembed/1.0/embed → l'anteprima dei link contiene un indirizzo email");

        Assert.That(problems, Is.Empty, "Il sito rivela informazioni sugli utenti:\n" + string.Join("\n", problems));
    }

    // File che WordPress installa (o può creare) e che non servono ai visitatori.
    // readme.html e version.php possono rivelare la versione; debug.log può contenere percorsi ed errori.
    private static readonly string[] SystemFiles =
        ["/readme.html", "/wp-includes/version.php", "/wp-content/debug.log", "/wp-config.php.bak"];

    // Cartelle che non devono mostrare l'elenco dei file ("Index of /…").
    private static readonly string[] Folders = ["/wp-content/uploads/", "/wp-content/plugins/", "/wp-includes/"];

    [Test]
    [AllureName("I file di sistema non sono accessibili")]
    [AllureLabel(NameEn, "System files are not accessible")]
    [AllureDescription("I file interni di WordPress (readme, versione, log degli errori, copie della configurazione) " +
                       "non si possono scaricare, le cartelle non mostrano l'elenco dei file e XML-RPC, un vecchio canale " +
                       "usato per provare le password in massa, non risponde.")]
    [AllureSeverity(Major)]
    public async Task SystemFilesAreNotAccessible()
    {
        await using var http = await Playwright.APIRequest.NewContextAsync();
        var problems = new List<string>();

        foreach (var path in SystemFiles)
        {
            var response = await http.GetAsync(Canonical + path, new() { MaxRedirects = 0 });
            await SkipIfCaptchaAsync(response);
            if (response.Ok)
                problems.Add($"{path} → si può scaricare ({response.Status})");
        }

        foreach (var path in Folders)
        {
            var response = await http.GetAsync(Canonical + path, new() { MaxRedirects = 0 });
            await SkipIfCaptchaAsync(response);
            if (response.Ok && (await response.TextAsync()).Contains("Index of", StringComparison.OrdinalIgnoreCase))
                problems.Add($"{path} → mostra l'elenco dei file");
        }

        // XML-RPC: chiediamo l'elenco dei comandi disponibili, una richiesta innocua.
        // Se il canale è chiuso il server rifiuta o interrompe la connessione: per noi va bene.
        try
        {
            var xmlrpc = await http.PostAsync(Canonical + "/xmlrpc.php", new()
            {
                Data = "<?xml version=\"1.0\"?><methodCall><methodName>system.listMethods</methodName></methodCall>",
                Headers = new Dictionary<string, string> { ["Content-Type"] = "text/xml" },
                MaxRedirects = 0,
            });
            await SkipIfCaptchaAsync(xmlrpc);
            if (xmlrpc.Ok && (await xmlrpc.TextAsync()).Contains("methodResponse"))
                problems.Add("/xmlrpc.php → risponde ai comandi");
        }
        catch (PlaywrightException)
        {
            // Connessione chiusa dal server: XML-RPC è bloccato.
        }

        Assert.That(problems, Is.Empty, "File o cartelle accessibili:\n" + string.Join("\n", problems));
    }

    // ---------------------------------------------------------------------
    // Contenuti misti (nel browser)
    // ---------------------------------------------------------------------

    private static readonly string[] MixedContentPages =
        ["/", "/playground/", "/carriera/", "/en/", "/category/articoli-tecnici/"];

    [Test]
    [AllureName("Le pagine non caricano contenuti non protetti")]
    [AllureLabel(NameEn, "Pages don't load unprotected content")]
    [AllureDescription("Le pagine in HTTPS non caricano immagini, script, stili o video da indirizzi http:// " +
                       "(contenuti misti): sarebbero un punto debole della connessione cifrata e i browser li bloccano.")]
    [AllureSeverity(Major)]
    public async Task PagesDontLoadUnprotectedContent()
    {
        // Due controlli complementari:
        // - le richieste che il browser fa davvero verso http://;
        // - gli indirizzi http:// scritti nella pagina. Servono perché Chrome e gli altri browser
        //   spesso correggono o bloccano da soli i contenuti misti prima di richiederli:
        //   il visitatore non vede l'errore, ma l'immagine o lo script possono sparire.
        var insecureRequests = new List<string>();
        Page.Request += (_, request) =>
        {
            if (request.Url.StartsWith("http://")) insecureRequests.Add(request.Url);
        };

        var problems = new List<string>();
        foreach (var path in MixedContentPages)
        {
            insecureRequests.Clear();
            await OpenAsync(Canonical + path);
            await Page.WaitForLoadStateAsync(LoadState.Load);

            var insecureInPage = await Page.EvaluateAsync<string[]>("""
                () => [...document.querySelectorAll(
                        'img[src], script[src], iframe[src], source[src], video[src], audio[src], ' +
                        'link[rel~="stylesheet"][href], img[srcset], source[srcset]')]
                    .flatMap(el => [el.getAttribute('src'), el.getAttribute('href'),
                                    ...(el.getAttribute('srcset') ?? '').split(',').map(s => s.trim().split(' ')[0])])
                    .filter(url => url && url.startsWith('http://'))
                """);

            foreach (var url in insecureRequests.Concat(insecureInPage).Distinct())
                problems.Add($"{path} → {url}");
        }

        Assert.That(problems, Is.Empty, "Contenuti caricati senza HTTPS:\n" + string.Join("\n", problems));
    }

    private static readonly Regex BotCheck = new(@"/\.well-known/(sg)?captcha/", RegexOptions.Compiled);

    /// <summary>
    /// La protezione anti-bot di SiteGround può rispondere con una verifica invece della pagina:
    /// in quel caso il controllo è "non verificabile", non fallito (come per i test nel browser).
    /// La verifica arriva in due forme: un redirect verso /.well-known/…captcha/ oppure una piccola
    /// pagina HTML che rimanda lì (meta refresh). Nel secondo caso mancano tutti gli header del sito:
    /// senza questo controllo i test sugli header fallirebbero per un motivo che non dipende dal sito.
    /// </summary>
    private static async Task SkipIfCaptchaAsync(IAPIResponse response)
    {
        var location = response.Headers.GetValueOrDefault("location") ?? "";
        var isHtml = response.Headers.GetValueOrDefault("content-type")?.Contains("text/html") == true;
        if (BotCheck.IsMatch(location) || (isHtml && BotCheck.IsMatch(await response.TextAsync())))
        {
            Assert.Ignore("Non verificabile: la protezione anti-bot dell'hosting ha mostrato un CAPTCHA.");
        }
    }
}
