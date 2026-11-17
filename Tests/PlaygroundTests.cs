using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

[TestFixture]
[Category("Regression")]
[AllureFeature("Playground")]
[AllureLabel(FeatureEn, "Playground")]
public class PlaygroundTests : QualityLabTest
{
    private const string PlaygroundUrl = BaseUrl + "/playground/";

    [Test]
    [AllureName("La pagina Playground mostra i risultati aggiornati")]
    [AllureLabel(NameEn, "The Playground page shows up-to-date results")]
    [AllureDescription("La pagina Playground carica e mostra i risultati dell'ultima esecuzione dei test.")]
    [AllureSeverity(Blocker)]
    public async Task PlaygroundShowsLatestResults()
    {
        await OpenAsync(PlaygroundUrl);

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
    [AllureName("La pagina Playground è disponibile anche in inglese")]
    [AllureLabel(NameEn, "The Playground page is also available in English")]
    [AllureDescription("Nella versione /en/ del sito, stato, statistiche e nomi dei controlli sono in inglese.")]
    [AllureSeverity(Major)]
    public async Task PlaygroundIsTranslatedToEnglish()
    {
        await OpenAsync(BaseUrl + "/en/playground/");

        await Expect(Page.Locator(".qlp-pill"))
            .ToHaveTextAsync(new Regex("Site operational|Issues detected"), new() { Timeout = 15_000 });

        await Expect(Page.Locator(".qlp-stat").Filter(new() { HasText = "checks passed" }))
            .ToContainTextAsync(new Regex(@"\d+/\d+"));

        // Anche i nomi dei controlli devono essere in inglese, non solo le etichette.
        await Expect(Page.Locator(".qlp-name").First).ToHaveTextAsync(new Regex("^The "));
    }

    [Test]
    [AllureName("Si possono vedere i risultati di un singolo browser")]
    [AllureLabel(NameEn, "Results can be viewed for a single browser")]
    [AllureDescription("Selezionando la scheda di un browser, la pagina mostra solo i risultati di quel browser.")]
    [AllureSeverity(Major)]
    public async Task BrowserTabShowsSingleBrowserResults()
    {
        await OpenAsync(PlaygroundUrl);

        var firefoxTab = Page.GetByRole(AriaRole.Tab, new() { Name = "Firefox" });
        await firefoxTab.ClickAsync(new() { Timeout = 15_000 });

        await Expect(firefoxTab).ToHaveAttributeAsync("aria-selected", "true");
        // Nella scheda di un solo browser spariscono i badge degli altri browser...
        await Expect(Page.Locator(".qlp-browsers")).ToHaveCountAsync(0);
        // ...e il pulsante avvia i controlli solo su quel browser.
        await Expect(Page.GetByRole(AriaRole.Button, new()
            {
                NameRegex = new Regex("Avvia i controlli su Firefox|Disponibile tra|Controlli in corso"),
            }))
            .ToBeVisibleAsync();
    }

    [Test]
    [AllureName("Si possono filtrare i controlli per priorità")]
    [AllureLabel(NameEn, "Checks can be filtered by priority")]
    [AllureDescription("Con il filtro \"Blocker\" la pagina mostra solo i controlli Blocker.")]
    [AllureSeverity(Major)]
    public async Task PriorityFilterShowsOnlySelectedChecks()
    {
        await OpenAsync(PlaygroundUrl);

        // Il nome del pulsante contiene anche il conteggio, es. "Blocker 9": cerchiamo quello che inizia con "Blocker".
        var blockerFilter = Page.Locator(".qlp-filter").GetByRole(AriaRole.Button, new() { NameRegex = new Regex("^Blocker") });
        await blockerFilter.ClickAsync(new() { Timeout = 15_000 });

        await Expect(blockerFilter).ToHaveAttributeAsync("aria-pressed", "true");
        var list = Page.Locator(".qlp-tests");
        await Expect(list.Locator(".qlp-prio-blocker")).Not.ToHaveCountAsync(0);
        await Expect(list.Locator(".qlp-prio-major")).ToHaveCountAsync(0);
    }

    [Test]
    [AllureName("I visitatori possono avviare i controlli")]
    [AllureLabel(NameEn, "Visitors can start the checks")]
    [AllureDescription("Il pulsante per i visitatori è presente: se manca, il token GitHub in WordPress non è configurato o è scaduto.")]
    [AllureSeverity(Blocker)]
    public async Task RunButtonIsAvailable()
    {
        await OpenAsync(PlaygroundUrl);

        // Non lo clicchiamo: questo test gira ogni ora e avvierebbe un'altra esecuzione all'infinito.
        // Verifichiamo solo che ci sia, in uno dei suoi stati possibili.
        await Expect(Page.GetByRole(AriaRole.Button, new()
            {
                NameRegex = new Regex("Avvia i controlli ora|Disponibile tra|Controlli in corso"),
            }))
            .ToBeVisibleAsync(new() { Timeout = 15_000 });
    }
}
