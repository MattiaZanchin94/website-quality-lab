using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

[TestFixture]
[Category("Smoke")]
[AllureFeature("Navigazione")]
[AllureSeverity(SeverityLevel.critical)]
public class NavigationTests : QualityLabTest
{
    // Le voci del menu principale, nell'ordine in cui compaiono sul sito.
    // È l'unico punto da aggiornare quando il menu cambia.
    private static readonly (string Label, string Path)[] MainMenu =
    [
        ("Home", "/"),
        ("Software testing", "/software-testing/"),
        ("Origini", "/origini/"),
        ("Carriera", "/carriera/"),
        ("Articoli tecnici", "/category/articoli-tecnici/"),
        ("Playground", "/playground/"),
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
        var position = Array.FindIndex(MainMenu, item => item.Label == menuLabel) + 1;
        AllureApi.AddLabel("order", position.ToString());

        await Page.GotoAsync(BaseUrl);

        // Il tema ha due menu (desktop e mobile): prendiamo solo il link visibile nell'header.
        var menuLink = Page.Locator("header")
            .GetByRole(AriaRole.Link, new() { Name = menuLabel, Exact = true })
            .Filter(new() { Visible = true });

        await menuLink.ClickAsync();

        await Expect(Page).ToHaveURLAsync(BaseUrl + expectedPath);
        await Expect(Page).ToHaveTitleAsync(new Regex($"^{Regex.Escape(menuLabel)} - "));
    }
}
