using Microsoft.Playwright.NUnit;

namespace QualityLab.Tests;

[TestFixture]
public class WebsiteAvailabilityTests : PageTest
{
    private const string BaseUrl = "https://mattiazanchin.com";

    [Test]
    public async Task WebsiteIsOnline()
    {
        var response = await Page.GotoAsync(BaseUrl);

        Assert.That(response, Is.Not.Null);
        Assert.That(response!.Status, Is.EqualTo(200));

        await Expect(Page.Locator("body")).ToBeVisibleAsync();
    }
}
