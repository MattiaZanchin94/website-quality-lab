using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

[TestFixture]
[Category("Functional")]
[Category("Smoke")]
[AllureFeature("Navigazione")]
[AllureLabel(FeatureEn, "Navigation")]
[AllureSeverity(Blocker)]
public class NavigationTests : QualityLabTest
{
    // Le voci del menu principale, nell'ordine in cui compaiono sul sito, con:
    //   - il titolo principale (H1) che la pagina deve mostrare (la Home ha un titolo diverso dalla voce);
    //   - il nome della voce nella versione inglese (/en/).
    // È l'unico punto da aggiornare quando il menu cambia.
    private static readonly (string Label, string Path, string Heading, string LabelEn)[] MainMenu =
    [
        ("Home", "/", "Software testing", "Home"),
        ("Software testing", "/software-testing/", "Software testing", "Software testing"),
        ("Origini", "/origini/", "Origini", "Origins"),
        ("Carriera", "/carriera/", "Carriera", "Career"),
        ("Articoli tecnici", "/category/articoli-tecnici/", "Articoli tecnici", "Technical articles"),
        ("Playground", "/playground/", "Playground", "Playground"),
    ];

    // [TestCaseSource] genera un test per ogni voce: stessa logica, dati diversi
    // (data-driven testing), con i dati presi dall'array invece che da tanti [TestCase].
    private static IEnumerable<TestCaseData> MenuItems() =>
        MainMenu.Select(item => new TestCaseData(item.Label, item.Path));

    [TestCaseSource(nameof(MenuItems))]
    public async Task MenuItemOpensExpectedPage(string menuLabel, string expectedPath)
    {
        // Il nome dipende dai dati, quindi lo impostiamo a runtime.
        AllureApi.SetTestName($"La voce di menu «{menuLabel}» porta alla pagina giusta");

        // Posizione nel menu (1 = Home): serve alla pagina Playground per mostrare le voci in quest'ordine.
        var index = Array.FindIndex(MainMenu, item => item.Label == menuLabel);
        AllureApi.AddLabel("order", (index + 1).ToString());
        SetEnglishName($"The “{MainMenu[index].LabelEn}” menu item opens the right page");

        await OpenAsync(BaseUrl);

        // Il tema ha due menu (desktop e mobile): prendiamo solo il link visibile nell'header.
        var menuLink = Page.Locator("header")
            .GetByRole(AriaRole.Link, new() { Name = menuLabel, Exact = true })
            .Filter(new() { Visible = true });
        // Su smartphone e tablet le voci sono nascoste dietro il pulsante "Menu di navigazione".
        var menuToggle = Page.Locator("header .navbar-toggle").Filter(new() { Visible = true });

        await OpenMenuIfClosedAsync(menuLink, menuToggle);
        await menuLink.ClickAsync();
        await SkipIfBlockedByBotProtectionAsync();

        // 1) Siamo sulla pagina giusta: indirizzo e titolo della scheda del browser.
        await Expect(Page).ToHaveURLAsync(BaseUrl + expectedPath);
        await Expect(Page).ToHaveTitleAsync(new Regex($"^{Regex.Escape(menuLabel)} - "));

        // 2) La pagina mostra davvero titolo e testo, come li vede il visitatore.
        await ExpectPageShowsContentAsync(MainMenu[index].Heading);
    }

    /// <summary>
    /// Su smartphone e tablet in verticale le voci sono dietro il pulsante del menu: lo apriamo
    /// come farebbe una persona. Su desktop (e tablet in orizzontale) il menu è già visibile.
    /// </summary>
    /// <remarks>
    /// Subito dopo il caricamento l'hosting può far passare il browser dal suo controllo anti-bot
    /// automatico e ricaricare la pagina: il menu appena aperto si richiude, oppure il tocco arriva
    /// prima che la pagina sia pronta. Per questo aspettiamo la pagina vera prima di decidere e,
    /// se dopo un tocco il menu non si apre, tocchiamo di nuovo (al massimo 3 volte).
    /// Un menu davvero rotto fa comunque fallire il test.
    /// </remarks>
    private async Task OpenMenuIfClosedAsync(ILocator menuLink, ILocator menuToggle)
    {
        const int attempts = 3;
        for (var attempt = 1; attempt <= attempts; attempt++)
        {
            // La pagina vera: la voce di menu (menu aperto) oppure il pulsante (menu chiuso).
            await Expect(menuLink.Or(menuToggle).First).ToBeVisibleAsync(new() { Timeout = 20_000 });
            if (await menuLink.CountAsync() > 0) return;

            await menuToggle.First.ClickAsync();
            try
            {
                await Expect(menuLink).ToBeVisibleAsync(new() { Timeout = 5_000 });
                return;
            }
            catch (Exception ex) when (attempt < attempts && ex is PlaywrightException or TimeoutException)
            {
                // Il menu non si è aperto: si riprova dalla pagina com'è adesso.
            }
        }
    }
}
