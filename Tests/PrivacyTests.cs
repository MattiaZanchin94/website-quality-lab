using System.Text.RegularExpressions;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Conformità al GDPR: il sito non deve tracciare chi non ha dato il consenso.
/// Ogni test si comporta come un visitatore nuovo e controlla
/// che cosa succede davvero nel browser, non solo che il banner sia presente:
/// prima della scelta, dopo il rifiuto e dopo l'accettazione.
/// </summary>
[TestFixture]
[Category("Privacy")]
[Category("Regression")]
[AllureFeature("Privacy")]
[AllureLabel(FeatureEn, "Privacy")]
public class PrivacyTests : QualityLabTest
{
    // Servizi che possono partire solo con il consenso (oltre a Google Analytics, controllato a parte).
    private static readonly Regex ConsentOnlyServices = new(@"^https?://([^/]+\.)?jam\.dev/", RegexOptions.Compiled);

    [Test]
    [AllureName("Prima della scelta il sito non traccia nulla")]
    [AllureLabel(NameEn, "Nothing is tracked before the visitor chooses")]
    [AllureDescription("Un visitatore nuovo vede il banner con «Accetta» e «Nega» sullo stesso piano. Finché non sceglie, " +
                       "il sito non imposta i cookie di Google Analytics, invia a Google solo segnali senza consenso e non carica Jam.")]
    [AllureSeverity(Major)]
    [AllureLabel("order", "1")]
    public async Task NothingIsTrackedBeforeChoice()
    {
        var consentOnlyRequests = await StartAsNewVisitorAsync();

        await WaitForAnalyticsAsync();
        await ExpectNoTrackingAsync("prima della scelta", consentOnlyRequests);
    }

    [Test]
    [AllureName("Se il visitatore rifiuta i cookie, il sito non traccia nulla")]
    [AllureLabel(NameEn, "Nothing is tracked after the visitor declines cookies")]
    [AllureDescription("Il visitatore preme «Nega» e passa a un'altra pagina: il banner non ricompare, il rifiuto è salvato " +
                       "e il sito continua a non impostare i cookie di Google Analytics, a inviare solo segnali senza consenso e a non caricare Jam.")]
    [AllureSeverity(Major)]
    [AllureLabel("order", "2")]
    public async Task NothingIsTrackedAfterDeclining()
    {
        var consentOnlyRequests = await StartAsNewVisitorAsync();
        var deny = Page.GetByRole(AriaRole.Button, new() { Name = "Nega", Exact = true });
        await deny.ClickAsync();
        await Expect(deny).ToBeHiddenAsync();

        // Su un'altra pagina la scelta è ricordata: il banner non ricompare.
        // (Il pulsante "Gestisci consenso" non si controlla qui: su schermi piccoli Complianz lo nasconde.)
        BlockedAnalyticsHits.Clear();
        consentOnlyRequests.Clear();
        await OpenAsync(BaseUrl + "/carriera/");
        await WaitForAnalyticsAsync();
        await Expect(deny).ToBeHiddenAsync();

        var statistics = (await Context.CookiesAsync()).FirstOrDefault(c => c.Name == "cmplz_statistics");
        Assert.That(statistics?.Value, Is.EqualTo("deny"), "Il rifiuto delle statistiche non è stato salvato.");

        await ExpectNoTrackingAsync("dopo il rifiuto", consentOnlyRequests);
    }

    [Test]
    [AllureName("Se il visitatore accetta i cookie, le statistiche si attivano")]
    [AllureLabel(NameEn, "Statistics start once the visitor accepts cookies")]
    [AllureDescription("Il visitatore preme «Accetta» e passa a un'altra pagina: il banner non ricompare, il consenso è salvato, " +
                       "Google Analytics imposta i suoi cookie e invia a Google le visite con il consenso alle statistiche. " +
                       "Gli invii vengono comunque bloccati dal test: le statistiche del sito restano pulite.")]
    [AllureSeverity(Major)]
    [AllureLabel("order", "3")]
    public async Task StatisticsStartAfterAccepting()
    {
        await StartAsNewVisitorAsync();
        var accept = Page.GetByRole(AriaRole.Button, new() { Name = "Accetta", Exact = true });
        await accept.ClickAsync();
        await Expect(accept).ToBeHiddenAsync();

        BlockedAnalyticsHits.Clear();
        await OpenAsync(BaseUrl + "/carriera/");
        await WaitForAnalyticsAsync();
        await Expect(accept).ToBeHiddenAsync();

        var cookies = await Context.CookiesAsync();
        var statistics = cookies.FirstOrDefault(c => c.Name == "cmplz_statistics");
        Assert.That(statistics?.Value, Is.EqualTo("allow"), "Il consenso alle statistiche non è stato salvato.");
        Assert.That(cookies.Select(c => c.Name), Has.Some.StartsWith("_ga"),
            "Dopo l'accettazione Google Analytics non ha impostato i suoi cookie: le statistiche non partono.");
        // gcs=G1x1: il terzo carattere dopo la "G" è il consenso alle statistiche (1 = concesso).
        Assert.That(BlockedAnalyticsHits.Any(h => Regex.IsMatch(h, @"[?&]gcs=G1\d1")), Is.True,
            "Dopo l'accettazione Google Analytics non ha inviato visite con il consenso alle statistiche.");
    }

    /// <summary>
    /// Visitatore nuovo: il test gestisce da sé il banner, apre la Home e verifica che il banner offra
    /// «Accetta» e «Nega» sullo stesso piano. Restituisce l'elenco (che si riempie da solo) delle richieste
    /// ai servizi che possono partire solo con il consenso.
    /// </summary>
    private async Task<List<string>> StartAsNewVisitorAsync()
    {
        await LetTestHandleCookieBannerAsync();

        var consentOnlyRequests = new List<string>();
        Page.Request += (_, request) =>
        {
            if (ConsentOnlyServices.IsMatch(request.Url)) consentOnlyRequests.Add(request.Url);
        };

        await OpenAsync(BaseUrl);
        await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Accetta", Exact = true })).ToBeVisibleAsync(new() { Timeout = 15_000 });
        await Expect(Page.GetByRole(AriaRole.Button, new() { Name = "Nega", Exact = true })).ToBeVisibleAsync();
        return consentOnlyRequests;
    }

    /// <summary>
    /// Aspetta che Google Analytics abbia contattato Google almeno una volta (al massimo 15 secondi):
    /// da quel momento gli script della pagina hanno già deciso se rispettare il consenso o no.
    /// Poi lascia ancora un attimo agli altri servizi, che partono insieme.
    /// </summary>
    private async Task WaitForAnalyticsAsync()
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (BlockedAnalyticsHits.Count == 0 && DateTime.UtcNow < deadline)
        {
            await Page.WaitForTimeoutAsync(250);
        }
        await Page.WaitForTimeoutAsync(1_000);
    }

    /// <summary>Verifica che nel browser non ci sia traccia di statistiche o servizi soggetti a consenso.</summary>
    private async Task ExpectNoTrackingAsync(string moment, List<string> consentOnlyRequests)
    {
        var cookies = await Context.CookiesAsync();
        Assert.That(cookies.Select(c => c.Name), Has.None.StartsWith("_ga"),
            $"Google Analytics ha impostato i suoi cookie {moment}.");

        Assert.That(consentOnlyRequests, Is.Empty,
            $"Un servizio che richiede il consenso è stato caricato {moment}: {string.Join(", ", consentOnlyRequests)}");

        // Con il Consent Mode, Google riceve solo segnali anonimi: il parametro gcs ne indica lo stato.
        // Es. G100 = statistiche negate. Il terzo carattere dopo la "G" è il consenso alle statistiche.
        foreach (var hit in BlockedAnalyticsHits)
        {
            var gcs = Regex.Match(hit, @"[?&]gcs=G1\d(\d)").Groups[1].Value;
            Assert.That(gcs, Is.EqualTo("0"),
                $"Google Analytics ha inviato dati senza il consenso negato {moment}: {hit}");
        }
    }
}
