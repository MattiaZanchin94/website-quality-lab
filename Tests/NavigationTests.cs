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
[AllureFeature("Navigazione")]
[AllureSeverity(SeverityLevel.critical)]
public class NavigationTests : PageTest
{
    private const string BaseUrl = "https://mattiazanchin.com";

    // Ogni [TestCase] diventa un test separato nel report:
    // stessa logica, dati diversi (data-driven testing).
    [TestCase("Home", "/")]
    [TestCase("Software testing", "/software-testing/")]
    [TestCase("Origini", "/origini/")]
    [TestCase("Carriera", "/carriera/")]
    [TestCase("Articoli tecnici", "/category/articoli-tecnici/")]
    [TestCase("Playground", "/playground/")]
    public async Task MenuItemOpensExpectedPage(string menuLabel, string expectedPath)
    {
        // Con [TestCase] il nome dipende dai dati, quindi lo impostiamo a runtime.
        AllureApi.SetTestName($"La voce di menu «{menuLabel}» porta alla pagina giusta");

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
