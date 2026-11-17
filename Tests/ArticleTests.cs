using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Microsoft.Playwright;

namespace QualityLab.Tests;

[TestFixture]
[Category("Regression")]
[AllureFeature("Articoli tecnici")]
[AllureSeverity(SeverityLevel.normal)]
public class ArticleTests : QualityLabTest
{
    private const string CategoryUrl = BaseUrl + "/category/articoli-tecnici/";

    [Test]
    [AllureName("L'ultimo articolo pubblicato si apre con titolo e contenuto")]
    public async Task LatestTechnicalArticleOpens()
    {
        await Page.GotoAsync(CategoryUrl);

        // Prendiamo l'articolo più recente, qualunque sia:
        // il test resta valido anche quando pubblichi un nuovo articolo.
        var titleLink = Page.Locator("article").First
            .GetByRole(AriaRole.Heading, new() { Level = 2 })
            .GetByRole(AriaRole.Link);

        // Leggiamo titolo e indirizzo PRIMA del click: sono il "risultato atteso".
        // TextContent legge il testo dell'HTML; InnerText lo leggerebbe come appare a schermo,
        // e il tema mostra i titoli della lista in MAIUSCOLO tramite CSS.
        var expectedTitle = (await titleLink.TextContentAsync() ?? "").Trim();
        var expectedUrl = await titleLink.GetAttributeAsync("href");
        Assert.That(expectedUrl, Is.Not.Null.And.Not.Empty);

        await titleLink.ClickAsync();

        // La pagina aperta è proprio quell'articolo...
        await Expect(Page).ToHaveURLAsync(expectedUrl!);
        await Expect(Page.GetByRole(AriaRole.Heading, new() { Level = 1 }))
            .ToHaveTextAsync(expectedTitle);

        // ...e ha davvero un contenuto, non una pagina vuota.
        await Expect(Page.Locator(".entry-content")).Not.ToBeEmptyAsync();
    }
}
