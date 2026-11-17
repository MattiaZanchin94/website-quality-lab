using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;

namespace QualityLab.Tests;

[TestFixture]
[Category("Smoke")]
[AllureFeature("Disponibilità")]
[AllureLabel(FeatureEn, "Availability")]
public class WebsiteAvailabilityTests : QualityLabTest
{
    [Test]
    [AllureName("Il sito è raggiungibile e si carica correttamente")]
    [AllureLabel(NameEn, "The site is reachable and loads correctly")]
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
