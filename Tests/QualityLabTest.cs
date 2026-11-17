using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright.NUnit;
using Microsoft.Playwright.TestAdapter;

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

    // Nomi in inglese per la versione /en/ del sito, salvati come label Allure.
    // Si usano con [AllureLabel(NameEn, "...")] su un test o [AllureLabel(FeatureEn, "...")] su una classe.
    protected const string NameEn = "name_en";
    protected const string FeatureEn = "feature_en";

    /// <summary>Nome inglese impostato a runtime, per i test generati dai dati.</summary>
    protected static void SetEnglishName(string name) => AllureApi.AddLabel(NameEn, name);

    // BrowserName (ereditato da PlaywrightTest) vale chromium, firefox o webkit:
    // si sceglie con la variabile d'ambiente BROWSER, es. BROWSER=firefox dotnet test.
    // Edge è Chromium con un "channel" diverso, impostato dalla riga di comando:
    //   dotnet test -- Playwright.LaunchOptions.Channel=msedge

    /// <summary>Il browser reale: chromium, firefox, webkit oppure msedge.</summary>
    protected string ActualBrowser =>
        PlaywrightSettingsProvider.LaunchOptions?.Channel is { Length: > 0 } channel ? channel : BrowserName;

    [SetUp]
    public void TagBrowser()
    {
        // Il browser diventa un parametro del test: in Allure lo stesso test su
        // più browser risulta come esecuzioni distinte, ognuna con il suo storico.
        AllureApi.AddTestParameter("Browser", ActualBrowser);
        AllureApi.AddLabel("browser", ActualBrowser);
    }
}
