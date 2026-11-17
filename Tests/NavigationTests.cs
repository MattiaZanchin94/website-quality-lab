using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

[TestFixture]
[Category("Smoke")]
[AllureFeature("Navigazione")]
[AllureLabel(FeatureEn, "Navigation")]
[AllureSeverity(SeverityLevel.critical)]
public class NavigationTests : QualityLabTest
{
    // Le voci del menu principale, nell'ordine in cui compaiono sul sito,
    // con il nome che hanno nella versione inglese (/en/).
    // È l'unico punto da aggiornare quando il menu cambia.
    private static readonly (string Label, string Path, string LabelEn)[] MainMenu =
    [
        ("Home", "/", "Home"),
        ("Software testing", "/software-testing/", "Software testing"),
        ("Origini", "/origini/", "Origins"),
        ("Carriera", "/carriera/", "Career"),
        ("Articoli tecnici", "/category/articoli-tecnici/", "Technical articles"),
        ("Playground", "/playground/", "Playground"),
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

        await menuLink.ClickAsync();
        await SkipIfBlockedByBotProtectionAsync();

        await Expect(Page).ToHaveURLAsync(BaseUrl + expectedPath);
        await Expect(Page).ToHaveTitleAsync(new Regex($"^{Regex.Escape(menuLabel)} - "));
    }
}
