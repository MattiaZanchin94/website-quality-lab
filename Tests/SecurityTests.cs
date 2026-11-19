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
/// Smoke o Regression è indicato su ogni controllo (NUnit somma le categorie di classe e metodo):
/// smoke sono HTTPS e certificato, che se falliscono colpiscono tutti i visitatori e fanno partire l'avviso.
/// </summary>
[TestFixture]
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
    [Category("Smoke")]
    [AllureName("Il sito usa sempre una connessione sicura")]
    [AllureLabel(NameEn, "The site always uses a secure connection")]
    [AllureDescription("Ogni indirizzo senza HTTPS o con www porta, con un redirect permanente, " +
                       "alla stessa pagina su https://mattiazanchin.com.")]
    [AllureLabel(ExplainWhat, "Apre il sito con indirizzi vecchi o scritti in modo diverso (http://, www.) su più pagine e segue ogni passaggio: tutti devono arrivare alla versione cifrata, https://mattiazanchin.com.")]
    [AllureLabel(ExplainWhy, "Senza HTTPS quello che il visitatore vede e invia viaggia in chiaro: chi è sulla stessa rete, per esempio un Wi-Fi pubblico, potrebbe leggerlo o modificarlo. Questo controllo ha trovato una falla vera: solo la home passava a HTTPS, le altre pagine si aprivano anche senza cifratura.")]
    [AllureLabel(ExplainWhatEn, "Opens the site with old or differently written addresses (http://, www.) on several pages and follows every hop: they must all end up on the encrypted version, https://mattiazanchin.com.")]
    [AllureLabel(ExplainWhyEn, "Without HTTPS, what visitors see and send travels in plain text: anyone on the same network, such as public Wi-Fi, could read or change it. This check found a real flaw: only the home page switched to HTTPS, the other pages also opened unencrypted.")]
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
    [Category("Regression")]
    [AllureName("Il browser è obbligato a usare HTTPS")]
    [AllureLabel(NameEn, "Browsers are required to use HTTPS")]
    [AllureDescription("Le pagine inviano l'header Strict-Transport-Security (HSTS) per almeno 6 mesi: " +
                       "dopo la prima visita il browser non apre più il sito senza cifratura, nemmeno da un vecchio link.")]
    [AllureLabel(ExplainWhat, "Controlla che le pagine chiedano al browser di usare sempre HTTPS, per almeno 6 mesi (intestazione Strict-Transport-Security).")]
    [AllureLabel(ExplainWhy, "Dopo la prima visita il browser non prova più nemmeno la versione non cifrata: un vecchio link o un indirizzo digitato a mano non passano mai in chiaro, neanche per un istante.")]
    [AllureLabel(ExplainWhatEn, "Checks that pages tell the browser to always use HTTPS, for at least 6 months (Strict-Transport-Security header).")]
    [AllureLabel(ExplainWhyEn, "After the first visit the browser doesn't even try the unencrypted version: an old link or a hand-typed address never travels in plain text, not even for a moment.")]
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
    [Category("Regression")]
    [AllureName("Il sito non può essere inserito in altri siti")]
    [AllureLabel(NameEn, "The site cannot be embedded in other sites")]
    [AllureDescription("Le pagine inviano X-Frame-Options (DENY o SAMEORIGIN): un altro sito non può mostrarle " +
                       "dentro una cornice invisibile per far cliccare il visitatore a sua insaputa (clickjacking).")]
    [AllureLabel(ExplainWhat, "Controlla che le pagine vietino ad altri siti di mostrarle dentro una cornice (intestazione X-Frame-Options).")]
    [AllureLabel(ExplainWhy, "Un sito malevolo potrebbe mostrare il mio in modo invisibile, sotto un suo pulsante, e far cliccare il visitatore su qualcosa a sua insaputa. È la tecnica chiamata clickjacking.")]
    [AllureLabel(ExplainWhatEn, "Checks that pages forbid other sites from showing them inside a frame (X-Frame-Options header).")]
    [AllureLabel(ExplainWhyEn, "A malicious site could show mine invisibly, under one of its own buttons, and trick visitors into clicking something without knowing. The technique is called clickjacking.")]
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
    [Category("Regression")]
    [AllureName("Il browser riceve le protezioni di base")]
    [AllureLabel(NameEn, "Browsers receive the basic protections")]
    [AllureDescription("Le pagine inviano X-Content-Type-Options: nosniff (il browser non 'indovina' il tipo dei file) " +
                       "e una Referrer-Policy che non comunica ad altri siti l'indirizzo completo della pagina visitata.")]
    [AllureLabel(ExplainWhat, "Controlla due istruzioni per il browser: non \"indovinare\" il tipo dei file (nosniff) e non comunicare ad altri siti l'indirizzo completo della pagina da cui arriva il visitatore (Referrer-Policy).")]
    [AllureLabel(ExplainWhy, "La prima impedisce che un file innocuo venga eseguito come se fosse codice; la seconda evita che i dettagli degli indirizzi del sito finiscano nei dati di altri siti.")]
    [AllureLabel(ExplainWhatEn, "Checks two instructions for the browser: don't \"guess\" file types (nosniff) and don't tell other sites the full address of the page the visitor comes from (Referrer-Policy).")]
    [AllureLabel(ExplainWhyEn, "The first stops a harmless file from being run as if it were code; the second keeps the details of the site's addresses out of other sites' data.")]
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
    [Category("Smoke")]
    [AllureName("Il certificato di sicurezza è valido")]
    [AllureLabel(NameEn, "The security certificate is valid")]
    [AllureDescription("Il certificato HTTPS di mattiazanchin.com e www.mattiazanchin.com è riconosciuto dai browser, " +
                       "è intestato al sito e non scade nei prossimi 14 giorni.")]
    [AllureLabel(ExplainWhat, "Si collega al sito come fa il browser e legge il certificato HTTPS: deve essere emesso da un'autorità riconosciuta, intestato a mattiazanchin.com e valido ancora per almeno 14 giorni.")]
    [AllureLabel(ExplainWhy, "Il certificato è la carta d'identità del sito. Se scade, il browser mostra un avviso a tutta pagina e quasi tutti i visitatori se ne vanno. Il rinnovo è automatico: questo controllo avvisa se si inceppa, con due settimane di margine.")]
    [AllureLabel(ExplainWhatEn, "Connects to the site like a browser does and reads its HTTPS certificate: it must be issued by a recognised authority, made out to mattiazanchin.com and valid for at least 14 more days.")]
    [AllureLabel(ExplainWhyEn, "The certificate is the site's ID card. If it expires, browsers show a full-page warning and almost every visitor leaves. Renewal is automatic: this check flags it if renewal gets stuck, two weeks ahead.")]
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
    [Category("Regression")]
    [AllureName("L'elenco degli utenti non è pubblico")]
    [AllureLabel(NameEn, "The list of users is not public")]
    [AllureDescription("Chi non ha fatto l'accesso non può leggere i nomi utente di WordPress: l'API degli utenti " +
                       "non risponde, le pagine autore non rivelano il nome e l'anteprima dei link non contiene indirizzi email. " +
                       "Un nome utente noto è metà delle credenziali di accesso.")]
    [AllureLabel(ExplainWhat, "Prova i tre modi in cui WordPress, di base, rivela i nomi utente: l'elenco degli utenti nell'API, le pagine autore e l'anteprima che compare quando si condivide un link. Nessuno deve mostrarli.")]
    [AllureLabel(ExplainWhy, "Il nome utente è metà delle credenziali di accesso: chi lo conosce deve indovinare solo la password. Anche questo controllo nasce da un problema vero: il nome pubblico dell'amministratore era il suo indirizzo email.")]
    [AllureLabel(ExplainWhatEn, "Tries the three ways WordPress reveals usernames by default: the users list in the API, author pages and the preview shown when a link is shared. None of them may show them.")]
    [AllureLabel(ExplainWhyEn, "A username is half of the login credentials: whoever knows it only has to guess the password. This check also comes from a real problem: the admin's public name was their email address.")]
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
    [Category("Regression")]
    [AllureName("I file di sistema non sono accessibili")]
    [AllureLabel(NameEn, "System files are not accessible")]
    [AllureDescription("I file interni di WordPress (readme, versione, log degli errori, copie della configurazione) " +
                       "non si possono scaricare, le cartelle non mostrano l'elenco dei file e XML-RPC, un vecchio canale " +
                       "usato per provare le password in massa, non risponde.")]
    [AllureLabel(ExplainWhat, "Prova a scaricare file interni di WordPress (readme, log degli errori, copie della configurazione), a sfogliare le cartelle e a usare XML-RPC: tutto deve essere bloccato.")]
    [AllureLabel(ExplainWhy, "Questi file non servono ai visitatori, ma dicono molto a chi cerca un punto debole: versioni, percorsi, a volte password. XML-RPC è un vecchio canale usato per provare migliaia di password in pochi minuti.")]
    [AllureLabel(ExplainWhatEn, "Tries to download internal WordPress files (readme, error logs, configuration backups), to browse folders and to use XML-RPC: everything must be blocked.")]
    [AllureLabel(ExplainWhyEn, "Visitors don't need these files, but they tell a lot to someone looking for a weak spot: versions, paths, sometimes passwords. XML-RPC is an old channel used to try thousands of passwords in a few minutes.")]
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
    [Category("Regression")]
    [AllureName("Le pagine non caricano contenuti non protetti")]
    [AllureLabel(NameEn, "Pages don't load unprotected content")]
    [AllureDescription("Le pagine in HTTPS non caricano immagini, script, stili o video da indirizzi http:// " +
                       "(contenuti misti): sarebbero un punto debole della connessione cifrata e i browser li bloccano.")]
    [AllureLabel(ExplainWhat, "Apre le pagine principali nel browser e controlla che immagini, script, stili e video arrivino tutti da indirizzi https://.")]
    [AllureLabel(ExplainWhy, "Basta un solo contenuto in http:// per indebolire una pagina cifrata: il browser lo blocca, e l'immagine o la funzione spariscono, oppure segnala la pagina come non del tutto sicura.")]
    [AllureLabel(ExplainWhatEn, "Opens the main pages in the browser and checks that images, scripts, styles and videos all come from https:// addresses.")]
    [AllureLabel(ExplainWhyEn, "A single http:// item is enough to weaken an encrypted page: the browser blocks it, and the image or feature disappears, or flags the page as not fully secure.")]
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

    // ---------------------------------------------------------------------
    // Cookie
    // ---------------------------------------------------------------------

    [Test]
    [Category("Regression")]
    [AllureName("I cookie del sito sono protetti")]
    [AllureLabel(NameEn, "The site's cookies are protected")]
    [AllureDescription("Dopo la scelta sui cookie, ogni cookie del sito ha Secure (viaggia solo su HTTPS) " +
                       "e SameSite Lax o Strict (non viene inviato quando la richiesta parte da un altro sito).")]
    [AllureLabel(ExplainWhat, "Visita il sito come un visitatore nuovo, risponde al banner dei cookie, apre un'altra pagina e controlla ogni cookie salvato: deve viaggiare solo su connessioni cifrate (Secure) e non partire quando la richiesta arriva da un altro sito (SameSite).")]
    [AllureLabel(ExplainWhy, "I cookie ricordano le scelte del visitatore. Senza queste protezioni potrebbero essere letti su una connessione non cifrata, oppure usati da un altro sito per fare richieste a nome del visitatore.")]
    [AllureLabel(ExplainWhatEn, "Visits the site as a new visitor, answers the cookie banner, opens another page and checks every cookie saved: it must travel only over encrypted connections (Secure) and not be sent when the request comes from another site (SameSite).")]
    [AllureLabel(ExplainWhyEn, "Cookies remember the visitor's choices. Without these protections they could be read over an unencrypted connection, or used by another site to make requests on the visitor's behalf.")]
    [AllureSeverity(Major)]
    public async Task SiteCookiesAreProtected()
    {
        // Il banner lo gestiamo noi, come un visitatore: la scelta salva i cookie del consenso.
        await LetTestHandleCookieBannerAsync();
        await OpenAsync(Canonical + "/");
        var deny = Page.GetByRole(AriaRole.Button, new() { Name = "Nega", Exact = true });
        await deny.ClickAsync(new() { Timeout = 15_000 });
        await Expect(deny).ToBeHiddenAsync();
        await OpenAsync(Canonical + "/carriera/");

        // Solo i cookie di questo sito (i cookie di altri domini non dipendono da noi).
        var cookies = (await Context.CookiesAsync())
            .Where(c => c.Domain.TrimStart('.').EndsWith("mattiazanchin.com"))
            .ToList();
        Assert.That(cookies, Is.Not.Empty, "Nessun cookie del sito: il controllo non avrebbe nulla da verificare.");

        var problems = new List<string>();
        foreach (var cookie in cookies)
        {
            if (!cookie.Secure)
                problems.Add($"{cookie.Name} → senza Secure: può viaggiare anche senza HTTPS");
            if (cookie.SameSite == SameSiteAttribute.None)
                problems.Add($"{cookie.Name} → SameSite=None: viene inviato anche dalle richieste di altri siti");
        }

        Assert.That(problems, Is.Empty, "Cookie non protetti:\n" + string.Join("\n", problems));
    }

    // ---------------------------------------------------------------------
    // API del plugin Playground (codice mio)
    // ---------------------------------------------------------------------

    private const string PlaygroundApi = Canonical + "/wp-json/quality-lab/v1";

    // Forme tipiche dei segreti: token GitHub e intestazioni di autenticazione.
    private static readonly Regex Secret = new(@"github_pat_|ghp_[A-Za-z0-9]|Bearer\s|QLP_GITHUB_TOKEN|QLP_PROGRESS_KEY", RegexOptions.Compiled);

    [Test]
    [Category("Regression")]
    [AllureName("L'API del Playground accetta solo richieste autorizzate")]
    [AllureLabel(NameEn, "The Playground API only accepts authorised requests")]
    [AllureDescription("Senza la chiave segreta, o con una chiave sbagliata, non si può scrivere l'avanzamento in diretta; " +
                       "l'avvio dei controlli accetta solo POST; le risposte pubbliche non contengono token né chiavi.")]
    [AllureLabel(ExplainWhat, "Prova a usare le funzioni nascoste del Playground senza permesso: inviare risultati falsi senza chiave o con una chiave sbagliata, avviare i controlli nel modo sbagliato e cercare segreti nelle risposte pubbliche. Non avvia mai una verifica vera.")]
    [AllureLabel(ExplainWhy, "Il Playground parla con GitHub per conto dei visitatori: il token di accesso deve restare sul server e solo i test veri possono aggiornare l'avanzamento in diretta. È codice scritto da me, quindi lo verifico come il resto del sito.")]
    [AllureLabel(ExplainWhatEn, "Tries to use the Playground's hidden functions without permission: sending fake results with no key or a wrong key, starting the checks the wrong way and looking for secrets in public responses. It never starts a real run.")]
    [AllureLabel(ExplainWhyEn, "The Playground talks to GitHub on visitors' behalf: the access token must stay on the server and only real tests may update the live progress. It's code I wrote, so I check it like the rest of the site.")]
    [AllureSeverity(Major)]
    public async Task PlaygroundApiOnlyAcceptsAuthorizedRequests()
    {
        await using var http = await Playwright.APIRequest.NewContextAsync();
        var problems = new List<string>();

        // 1. Avanzamento in diretta: un risultato inventato, senza chiave e con una chiave sbagliata.
        //    WordPress deve rifiutarlo prima ancora di leggerlo (401 o 403).
        var fakeResult = new { runId = "1", browser = "chromium", key = "security-check", status = "passed" };
        foreach (var (label, key) in new[] { ("senza chiave", (string?)null), ("con una chiave sbagliata", "not-the-key") })
        {
            var options = new APIRequestContextOptions { DataObject = fakeResult, MaxRedirects = 0 };
            if (key is not null) options.Headers = new Dictionary<string, string> { ["X-QLP-Key"] = key };
            var response = await http.PostAsync(PlaygroundApi + "/progress", options);
            await SkipIfCaptchaAsync(response);
            if (response.Status is not (401 or 403))
                problems.Add($"/progress {label} → risponde {response.Status} invece di rifiutare (401/403)");
        }

        // 2. L'avvio dei controlli esiste solo come POST (con pausa e controlli lato server):
        //    una semplice visita all'indirizzo non deve fare nulla. Non lo chiamiamo mai in POST.
        var run = await http.GetAsync(PlaygroundApi + "/run", new() { MaxRedirects = 0 });
        await SkipIfCaptchaAsync(run);
        if (run.Ok)
            problems.Add($"/run in GET → risponde {run.Status}: dovrebbe esistere solo in POST");

        // 3. Lo stato è pubblico (lo legge la pagina): deve rispondere, ma senza segreti.
        var status = await http.GetAsync(PlaygroundApi + "/status");
        await SkipIfCaptchaAsync(status);
        if (!status.Ok)
            problems.Add($"/status → risponde {status.Status}: la pagina Playground non potrebbe funzionare");
        else if (Secret.IsMatch(await status.TextAsync()))
            problems.Add("/status → la risposta contiene un token o una chiave");

        Assert.That(problems, Is.Empty, "L'API del Playground accetta richieste che dovrebbe rifiutare:\n" + string.Join("\n", problems));
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
