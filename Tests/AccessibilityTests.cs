using System.Text.RegularExpressions;
using Allure.Net.Commons;
using Allure.Net.Commons.Attributes;
using Deque.AxeCore.Commons;
using Deque.AxeCore.Playwright;
using Microsoft.Playwright;

namespace QualityLab.Tests;

/// <summary>
/// Accessibilità BASE: i due controlli essenziali, sulle regole WCAG 2.2 livello AA.
/// Se falliscono, qualcuno non riesce proprio a usare il sito. Non girano nelle esecuzioni pubbliche
/// né nella Playground: si avviano dalla dashboard riservata, su Chrome, Firefox e Safari (la navigazione
/// da tastiera cambia da un browser all'altro). I controlli di dettaglio sono nel repository privato.
/// </summary>
[TestFixture]
[Category("Accessibility")]
[Category("Smoke")]
[AllureFeature("Accessibilità")]
[AllureLabel(FeatureEn, "Accessibility")]
public class AccessibilityTests : SeoDeepBase
{
    private static readonly AxeRunOptions Wcag22 = new()
    {
        RunOnly = new RunOnlyOptions { Type = "tag", Values = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    };

    /// <summary>Apre la pagina e chiude il banner dei cookie (rifiutando), così non si mette in mezzo al Tab.</summary>
    private async Task OpenWithoutBannerAsync(string path)
    {
        await OpenSettledAsync(path);
        var reject = Page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex(@"^\s*(nega|rifiuta|deny|reject)", RegexOptions.IgnoreCase) })
            .Filter(new() { Visible = true });
        if (await reject.CountAsync() > 0)
        {
            try { await reject.First.ClickAsync(new() { Timeout = 3000 }); } catch (PlaywrightException) { /* già chiuso */ }
        }
        await Page.WaitForTimeoutAsync(500);
    }

    [TestCaseSource(nameof(PageCases))]
    [AllureSeverity(Blocker)]
    [AllureLabel("order", "1")]
    [AllureLabel(ExplainWhat, "Analizza la pagina con axe-core, lo strumento di riferimento per l'accessibilità, sulle regole WCAG 2.2 di livello AA, e cerca le violazioni gravi o critiche.")]
    [AllureLabel(ExplainWhy, "Contrasti troppo bassi, immagini senza descrizione o pulsanti senza nome escludono chi usa un lettore di schermo o vede poco.")]
    [AllureLabel(ExplainWhatEn, "Scans the page with axe-core, the reference accessibility tool, against WCAG 2.2 level AA rules, looking for serious or critical violations.")]
    [AllureLabel(ExplainWhyEn, "Too little contrast, images without a description or unnamed buttons shut out people using a screen reader or with low vision.")]
    [AllureLabel(ExplainFix, "Il dettaglio dell'errore elenca ogni regola violata con gli elementi coinvolti: di solito si sistema aumentando il contrasto dei colori, aggiungendo il testo alternativo alle immagini e un nome a pulsanti e icone.")]
    [AllureLabel(ExplainFixEn, "The error details list each violated rule with the elements involved: it's usually fixed by raising colour contrast, adding alt text to images and a name to buttons and icons.")]
    public async Task PageHasNoSeriousAccessibilityIssues(string path)
    {
        var (it, en) = PageInfo(path);
        AllureApi.SetTestName($"La pagina «{it}» non ha problemi gravi di accessibilità");
        SetEnglishName($"The “{en}” page has no serious accessibility issues");
        await OpenWithoutBannerAsync(path);

        var result = await Page.RunAxe(Wcag22);
        var serious = result.Violations
            .Where(v => v.Impact is "serious" or "critical")
            .Select(v => $"[{v.Impact}] {v.Id}: {v.Help} — {v.Nodes.Length} elementi")
            .ToList();
        Assert.That(serious, Is.Empty, $"{serious.Count} regole WCAG violate in modo grave:\n" + string.Join("\n", serious));
    }

    [TestCaseSource(nameof(PageCases))]
    [AllureSeverity(Blocker)]
    [AllureLabel("order", "2")]
    [AllureLabel(ExplainWhat, "Usa la pagina solo con il tasto Tab, come chi non usa il mouse, e verifica di raggiungere sia il menu sia i link del contenuto.")]
    [AllureLabel(ExplainWhy, "Chi naviga con la tastiera, con un sensore o con comandi vocali deve poter arrivare a ogni link: se menu o contenuto non si raggiungono, il sito per loro è chiuso.")]
    [AllureLabel(ExplainWhatEn, "Uses the page with the Tab key only, like people who don't use a mouse, and checks it reaches both the menu and the content links.")]
    [AllureLabel(ExplainWhyEn, "People using a keyboard, a switch or voice control must reach every link: if the menu or the content can't be reached, the site is closed to them.")]
    [AllureLabel(ExplainFix, "Usa link e pulsanti veri (non elementi cliccabili creati con div o immagini) e controlla che il menu del tema si apra anche con Invio.")]
    [AllureLabel(ExplainFixEn, "Use real links and buttons (not clickable divs or images) and check the theme menu also opens with Enter.")]
    public async Task KeyboardReachesMenuAndContent(string path)
    {
        var (it, en) = PageInfo(path);
        AllureApi.SetTestName($"La pagina «{it}» si naviga con la tastiera");
        SetEnglishName($"The “{en}” page can be used with the keyboard");
        await OpenWithoutBannerAsync(path);

        await Page.EvaluateAsync("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }");
        bool inNav = false, inMain = false;
        var seen = new List<string>();
        for (var i = 0; i < 40 && !(inNav && inMain); i++)
        {
            // Safari su Mac si sposta tra i link con Opzione+Tab (è il tasto di chi naviga da tastiera su Mac);
            // WebKit su Linux, come nelle esecuzioni di GitHub, usa il Tab normale.
            await Page.Keyboard.PressAsync(BrowserName == "webkit" && OperatingSystem.IsMacOS() ? "Alt+Tab" : "Tab");
            var stop = await Page.EvaluateAsync<string[]?>(@"() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;
                return [el.tagName.toLowerCase() + ' «' + ((el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)) + '»',
                        String(!!el.closest('nav, header, [role=navigation]')), String(!!el.closest('main, article, [role=main]'))];
            }");
            if (stop is null) continue;
            if (seen.Count > 3 && seen.Skip(seen.Count - 2).All(s => s == stop[0])) break; // il focus non si muove più
            seen.Add(stop[0]);
            inNav |= stop[1] == "True" || stop[1] == "true";
            inMain |= stop[2] == "True" || stop[2] == "true";
        }
        Assert.Multiple(() =>
        {
            Assert.That(seen, Is.Not.Empty, "Con la tastiera il focus non arriva a nessun elemento.");
            Assert.That(inNav, Is.True, "Con la tastiera non si raggiunge il menu.");
            Assert.That(inMain, Is.True, "Con la tastiera non si raggiunge nessun link del contenuto.");
        });
    }
}
