using System.Net.Http.Json;

namespace QualityLab.Tests;

/// <summary>
/// Invia alla pagina Playground l'avanzamento in diretta dei test: "iniziato", "superato", "fallito"...
/// Funziona solo su GitHub Actions, quando il workflow fornisce indirizzo e chiave:
///   QLP_PROGRESS_URL  → endpoint del plugin WordPress (/wp-json/quality-lab/v1/progress)
///   QLP_PROGRESS_KEY  → chiave segreta condivisa (secret di GitHub + wp-config.php)
///   GITHUB_RUN_ID     → impostata da GitHub, identifica l'esecuzione
/// Regola d'oro: è un extra. Se l'invio non riesce, i test continuano come se niente fosse.
/// </summary>
internal static class LiveProgress
{
    private static readonly string? Url = Environment.GetEnvironmentVariable("QLP_PROGRESS_URL");
    private static readonly string? Key = Environment.GetEnvironmentVariable("QLP_PROGRESS_KEY");
    private static readonly string? RunId = Environment.GetEnvironmentVariable("GITHUB_RUN_ID");

    // Un solo HttpClient per tutta l'esecuzione (crearne uno per richiesta esaurirebbe le connessioni).
    private static readonly HttpClient Http = CreateClient();

    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("QualityLab-LiveProgress/1.0");
        return client;
    }

    public static bool Enabled =>
        !string.IsNullOrEmpty(Url) && !string.IsNullOrEmpty(Key) && !string.IsNullOrEmpty(RunId);

    /// <param name="status">running, passed, failed oppure skipped.</param>
    public static async Task ReportAsync(string browser, string testKey, string status)
    {
        if (!Enabled) return;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, Url)
            {
                Content = JsonContent.Create(new { runId = RunId, browser, key = testKey, status }),
            };
            request.Headers.Add("X-QLP-Key", Key);
            using var response = await Http.SendAsync(request);
            // L'esito non ci interessa: niente eccezioni, niente fallimenti.
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            TestContext.Progress.WriteLine($"[LiveProgress] invio non riuscito: {ex.Message}");
        }
    }
}
