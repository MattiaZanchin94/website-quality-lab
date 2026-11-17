using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;

namespace QualityLab.Tests;

[TestFixture]
[Category("Smoke")]
[AllureFeature("Disponibilità")]
[AllureLabel(FeatureEn, "Availability")]
public class WebsiteAvailabilityTests : QualityLabTest
{
    [Test]
    [AllureName("Il sito è raggiungibile e si carica correttamente")]
    [AllureLabel(NameEn, "The site is reachable and loads correctly")]
    [AllureSeverity(SeverityLevel.blocker)]
    [AllureDescription("La home page risponde senza errori e mostra il sito vero.")]
    public async Task WebsiteIsOnline()
    {
        var response = await OpenAsync(BaseUrl);

        // Qualsiasi 2xx va bene: a volte la protezione anti-bot di SiteGround risponde 202
        // con una pagina di verifica che, dopo un controllo in JavaScript, carica il sito vero.
        Assert.That(response, Is.Not.Null);
        Assert.That(response!.Ok, Is.True, $"La home page ha risposto con HTTP {response.Status}");

        // Il controllo decisivo: alla fine deve comparire il sito vero, non la pagina di verifica.
        await Expect(Page).ToHaveTitleAsync(new Regex("Mattia Zanchin"), new() { Timeout = 15_000 });
        await Expect(Page.Locator("header")).ToBeVisibleAsync();
    }
}
