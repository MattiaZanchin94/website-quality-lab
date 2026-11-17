// Legge i risultati Allure e scrive un summary.json compatto
// che la pagina "Playground" del sito WordPress può leggere.
//
// Uso: node scripts/summary.mjs <cartella allure-results> <file di output>

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const [resultsDir, outputFile] = process.argv.slice(2);
if (!resultsDir || !outputFile) {
  console.error("Uso: node scripts/summary.mjs <allure-results> <output.json>");
  process.exit(1);
}

const files = (await readdir(resultsDir)).filter((f) => f.endsWith("-result.json"));
const results = await Promise.all(
  files.map(async (f) => JSON.parse(await readFile(join(resultsDir, f), "utf8"))),
);

const label = (r, name) => r.labels?.find((l) => l.name === name)?.value ?? null;

// Ogni controllo gira su più browser: raggruppiamo le esecuzioni per nome del controllo.
const BROWSER_ORDER = ["chromium", "firefox", "webkit"];
const SEVERITY_OF_STATUS = { passed: 0, skipped: 1, broken: 2, failed: 3 };
const byTitle = new Map();

for (const r of results) {
  const title = r.name; // il nome leggibile impostato con [AllureName] o AllureApi.SetTestName
  const t = byTitle.get(title) ?? {
    title,
    // Nome del metodo C#, es. "MenuItemOpensExpectedPage" (senza firma dei parametri).
    method: r.fullName?.replace(/\(.*\)$/, "").split(".").pop() ?? null,
    feature: label(r, "feature"),
    severity: label(r, "severity"),
    // Posizione facoltativa (label "order"), es. l'ordine delle voci nel menu.
    order: Number(label(r, "order")) || null,
    // [Category("Smoke")] / [Category("Regression")] in C# diventano tag Allure.
    type: (r.labels ?? []).find((l) => l.name === "tag" && /^(smoke|regression)$/i.test(l.value))?.value.toLowerCase() ?? null,
    status: "passed", // il peggiore tra i browser
    durationMs: 0, // il più lento tra i browser
    browsers: {}, // es. { chromium: "passed", firefox: "failed" }
  };
  const browser = label(r, "browser") ?? "chromium";
  t.browsers[browser] = r.status;
  if (SEVERITY_OF_STATUS[r.status] > SEVERITY_OF_STATUS[t.status]) t.status = r.status;
  t.durationMs = Math.max(t.durationMs, r.stop - r.start);
  byTitle.set(title, t);
}

// Ordine di priorità: prima gli smoke, poi per severità (blocker → trivial), poi per area,
// poi per posizione esplicita ("order", es. ordine del menu) e infine per nome.
const TYPE_RANK = { smoke: 0, regression: 1 };
const SEVERITY_RANK = { blocker: 0, critical: 1, normal: 2, minor: 3, trivial: 4 };
const rank = (map, key) => map[key] ?? 99;

const tests = [...byTitle.values()].sort(
  (a, b) =>
    rank(TYPE_RANK, a.type) - rank(TYPE_RANK, b.type) ||
    rank(SEVERITY_RANK, a.severity) - rank(SEVERITY_RANK, b.severity) ||
    (a.feature ?? "").localeCompare(b.feature ?? "") ||
    (a.order ?? 99) - (b.order ?? 99) ||
    a.title.localeCompare(b.title),
);
const browsers = BROWSER_ORDER.filter((b) => tests.some((t) => b in t.browsers));

// I totali contano le singole esecuzioni: 10 controlli x 3 browser = 30.
const count = (status) => results.filter((r) => r.status === status).length;
const total = results.length;
const passed = count("passed");
const start = Math.min(...results.map((r) => r.start));
const stop = Math.max(...results.map((r) => r.stop));

const env = process.env;
const summary = {
  status: total > 0 && passed === total ? "passed" : "failed",
  total,
  passed,
  failed: count("failed"),
  broken: count("broken"),
  skipped: count("skipped"),
  successRate: total ? Math.round((passed / total) * 1000) / 10 : 0,
  checks: tests.length,
  browsers,
  startedAt: new Date(start).toISOString(),
  durationMs: stop - start,
  trigger: env.RUN_TRIGGER ?? "local",
  commit: env.GITHUB_SHA?.slice(0, 7) ?? null,
  runUrl: env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null,
  tests,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(summary, null, 2));
console.log(`summary.json: ${passed}/${total} superati (${summary.successRate}%) → ${outputFile}`);
