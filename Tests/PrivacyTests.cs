using System.Text.RegularExpressions;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Conformità al GDPR: il sito non deve tracciare chi non ha dato il consenso.
/// Il test si comporta come un visitatore nuovo che rifiuta i cookie e controlla
/// che cosa succede davvero nel browser, non solo che il banner sia presente.
/// </summary>
[TestFixture]
[Category("Regression")]
[AllureFeature("Privacy")]
[AllureLabel(FeatureEn, "Privacy")]
public class PrivacyTests : QualityLabTest
{
    // Servizi che possono partire solo con il consenso (oltre a Google Analytics, controllato a parte).
    private static readonly Regex ConsentOnlyServices = new(@"^https?://([^/]+\.)?jam\.dev/", RegexOptions.Compiled);

    [Test]
    [AllureName("Il sito rispetta il consenso ai cookie")]
    [AllureLabel(NameEn, "The site respects cookie consent")]
    [AllureDescription("Prima della scelta e dopo il rifiuto, il sito non imposta i cookie di Google Analytics, " +
                       "invia a Google solo segnali senza consenso e non carica Jam. La scelta viene ricordata tra le pagine.")]
    [AllureSeverity(Major)]
    public async Task SiteRespectsCookieConsent()
    {
        // Qui il banner lo gestisce il test, come farebbe un visitatore.
        await LetTestHandleCookieBannerAsync();

        var consentOnlyRequests = new List<string>();
        Page.Request += (_, request) =>
        {
            if (ConsentOnlyServices.IsMatch(request.Url)) consentOnlyRequests.Add(request.Url);
        };

        // 1. Visitatore nuovo: il banner chiede il consenso, con "Accetta" e "Nega" sullo stesso piano.
        await OpenAsync(BaseUrl);
        var accept = Page.GetByRole(AriaRole.Button, new() { Name = "Accetta", Exact = true });
        var deny = Page.GetByRole(AriaRole.Button, new() { Name = "Nega", Exact = true });
        await Expect(accept).ToBeVisibleAsync(new() { Timeout = 15_000 });
        await Expect(deny).ToBeVisibleAsync();

        await WaitForAnalyticsAsync();
        await ExpectNoTrackingAsync("prima della scelta", consentOnlyRequests);

        // 2. Il visitatore rifiuta.
        await deny.ClickAsync();
        await Expect(deny).ToBeHiddenAsync();

        // 3. Su un'altra pagina la scelta è ricordata: il banner non ricompare.
        // (Il pulsante "Gestisci consenso" non si controlla qui: su schermi piccoli Complianz lo nasconde.)
        BlockedAnalyticsHits.Clear();
        await OpenAsync(BaseUrl + "/carriera/");
        await WaitForAnalyticsAsync();
        await Expect(deny).ToBeHiddenAsync();

        var statistics = (await Context.CookiesAsync()).FirstOrDefault(c => c.Name == "cmplz_statistics");
        Assert.That(statistics?.Value, Is.EqualTo("deny"), "Il rifiuto delle statistiche non è stato salvato.");

        await ExpectNoTrackingAsync("dopo il rifiuto", consentOnlyRequests);
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
