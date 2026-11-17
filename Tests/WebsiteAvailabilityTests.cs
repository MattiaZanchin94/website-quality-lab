using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Allure.NUnit;
using Microsoft.Playwright.NUnit;

namespace QualityLab.Tests;

[TestFixture]
[AllureNUnit]
[AllureEpic("mattiazanchin.com")]
[AllureFeature("Disponibilità")]
public class WebsiteAvailabilityTests : PageTest
{
    private const string BaseUrl = "https://mattiazanchin.com";

    [Test]
    [AllureSeverity(SeverityLevel.blocker)]
    [AllureDescription("La home page risponde con HTTP 200 e viene visualizzata.")]
    public async Task WebsiteIsOnline()
    {
        var response = await Page.GotoAsync(BaseUrl);

        Assert.That(response, Is.Not.Null);
        Assert.That(response!.Status, Is.EqualTo(200));

        await Expect(Page.Locator("body")).ToBeVisibleAsync();
    }
}
