using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright.NUnit;

namespace QualityLab.Tests;

/// <summary>
/// Classe base di tutti i test: ciò che è comune sta qui, una volta sola.
/// Le classi di test ereditano da QualityLabTest invece che direttamente da PageTest.
/// </summary>
[AllureNUnit]
[AllureEpic("mattiazanchin.com")]
public abstract class QualityLabTest : PageTest
{
    protected const string BaseUrl = "https://mattiazanchin.com";

    // BrowserName (ereditato da PlaywrightTest) vale chromium, firefox o webkit:
    // si sceglie con la variabile d'ambiente BROWSER, es. BROWSER=firefox dotnet test.

    [SetUp]
    public void TagBrowser()
    {
        // Il browser diventa un parametro del test: in Allure lo stesso test su
        // tre browser risulta come tre esecuzioni distinte, ognuna con il suo storico.
        AllureApi.AddTestParameter("Browser", BrowserName);
        AllureApi.AddLabel("browser", BrowserName);
    }
}
