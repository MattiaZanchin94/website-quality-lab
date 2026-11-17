using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;

namespace QualityLab.Tests;

[TestFixture]
[AllureNUnit]
[AllureEpic("mattiazanchin.com")]
[AllureFeature("Playground")]
[AllureSeverity(SeverityLevel.normal)]
public class PlaygroundTests : PageTest
{
    private const string PlaygroundUrl = "https://mattiazanchin.com/playground/";

    [Test]
    [AllureName("La pagina Playground mostra i risultati aggiornati")]
    [AllureDescription("La pagina Playground carica e mostra i risultati dell'ultima esecuzione dei test.")]
    public async Task PlaygroundShowsLatestResults()
    {
        await Page.GotoAsync(PlaygroundUrl);

        // I risultati arrivano via JavaScript da summary.json: Expect aspetta che compaiano.
        // Niente ^...$ nella regex: nell'HTML il testo è circondato da spazi e a capo.
        await Expect(Page.Locator(".qlp-pill"))
            .ToHaveTextAsync(new Regex("Sito operativo|Problemi rilevati"), new() { Timeout = 15_000 });

        // Es. "8/9" accanto a "controlli superati".
        await Expect(Page.Locator(".qlp-stat").Filter(new() { HasText = "controlli superati" }))
            .ToContainTextAsync(new Regex(@"\d+/\d+"));

        await Expect(Page.Locator(".qlp-tests li")).Not.ToHaveCountAsync(0);
    }

    [Test]
    [AllureName("I visitatori possono avviare i controlli")]
    [AllureDescription("Il pulsante per i visitatori è presente: se manca, il token GitHub in WordPress non è configurato o è scaduto.")]
    public async Task RunButtonIsAvailable()
    {
        await Page.GotoAsync(PlaygroundUrl);

        // Non lo clicchiamo: questo test gira ogni ora e avvierebbe un'altra esecuzione all'infinito.
        // Verifichiamo solo che ci sia, in uno dei suoi stati possibili.
        await Expect(Page.GetByRole(AriaRole.Button, new()
            {
                NameRegex = new Regex("Avvia i controlli ora|Disponibile tra|Controlli in corso"),
            }))
            .ToBeVisibleAsync(new() { Timeout = 15_000 });
    }
}
