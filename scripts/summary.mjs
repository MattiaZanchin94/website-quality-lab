// Legge i risultati Allure e scrive un summary.json compatto
// che la pagina "Playground" del sito WordPress può leggere.
//
// Uso: node scripts/summary.mjs <cartella allure-results> <file di output> [summary precedente]

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const [resultsDir, outputFile, previousFile] = process.argv.slice(2);
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
const ALL_BROWSERS = ["chromium", "msedge", "firefox", "webkit", "iphone", "android", "fold", "ipad", "ipadland"];
const PRIORITY_OF_SEVERITY = { blocker: "blocker", critical: "blocker", normal: "major", minor: "minor", trivial: "minor" };
const SEVERITY_OF_STATUS = { passed: 0, skipped: 1, broken: 2, failed: 3 };
const env = process.env;
// Raggruppiamo per chiave del test (classe, metodo e dati), non per titolo: un controllo
// saltato già nel SetUp (es. dopo un CAPTCHA) non arriva a impostare il suo nome leggibile,
// e più casi dello stesso metodo finirebbero sotto lo stesso titolo provvisorio.
const byKey = new Map();
// Un risultato ha il nome definitivo quando il test ha impostato anche quello inglese.
const hasFinalName = (r) => Boolean(label(r, "name_en"));

for (const r of results) {
  const title = r.name; // il nome leggibile impostato con [AllureName] o AllureApi.SetTestName
  const id = label(r, "test_key") ?? title;
  const existing = byKey.get(id);
  if (existing && hasFinalName(r) && !existing.en.title) {
    // Il primo risultato visto era senza nome definitivo: prendiamo titolo e metadati da questo.
    Object.assign(existing, { title, en: { title: label(r, "name_en"), feature: label(r, "feature_en") }, order: Number(label(r, "order")) || null });
  }
  const t = existing ?? {
    title,
    // Chiave stabile del test (classe, metodo e dati): la stessa usata dall'avanzamento in diretta.
    key: label(r, "test_key"),
    // Nome del metodo C#, es. "MenuItemOpensExpectedPage" (senza firma dei parametri).
    method: r.fullName?.replace(/\(.*\)$/, "").split(".").pop() ?? null,
    feature: label(r, "feature"),
    // Testi per la versione inglese del sito (label name_en / feature_en impostate nei test C#).
    en: { title: label(r, "name_en"), feature: label(r, "feature_en") },
    severity: label(r, "severity"),
    // Priorità mostrata sul sito: Blocker oppure Major (il "normal" di Allure, vedi QualityLabTest).
    priority: PRIORITY_OF_SEVERITY[label(r, "severity")] ?? "major",
    // Posizione facoltativa (label "order"), es. l'ordine delle voci nel menu.
    order: Number(label(r, "order")) || null,
    // [Category("Smoke")] / [Category("Regression")] in C# diventano tag Allure.
    type: (r.labels ?? []).find((l) => l.name === "tag" && /^(smoke|regression)$/i.test(l.value))?.value.toLowerCase() ?? null,
    browsers: {}, // stato per browser, es. { chromium: "passed", firefox: "failed" }
    durations: {}, // durata in ms per browser
  };
  const browser = label(r, "browser") ?? "chromium";
  t.browsers[browser] = r.status;
  t.durations[browser] = r.stop - r.start;
  byKey.set(id, t);
}

// Le esecuzioni di questo run, per browser.
const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null;
const runInfo = (rs) => ({
  startedAt: new Date(Math.min(...rs.map((r) => r.start))).toISOString(),
  // Dentro un browser i test sono sequenziali: la durata è la somma dei singoli test.
  durationMs: rs.reduce((sum, r) => sum + (r.stop - r.start), 0),
  trigger: env.RUN_TRIGGER ?? "local",
  commit: env.GITHUB_SHA?.slice(0, 7) ?? null,
  runUrl,
});
const ranNow = [...new Set(results.map((r) => label(r, "browser") ?? "chromium"))];
const runs = Object.fromEntries(ranNow.map((b) => [b, runInfo(results.filter((r) => (label(r, "browser") ?? "chromium") === b))]));

// Se questo run riguarda solo alcuni browser, gli altri mantengono gli ultimi risultati pubblicati.
const isFullRun = ALL_BROWSERS.every((b) => ranNow.includes(b));
if (previousFile && !isFullRun) {
  const prev = JSON.parse(await readFile(previousFile, "utf8").catch(() => "null"));
  for (const pt of prev?.tests ?? []) {
    for (const [b, status] of Object.entries(pt.browsers ?? {})) {
      if (ranNow.includes(b)) continue;
      const id = pt.key ?? pt.title;
      const t = byKey.get(id) ?? { ...pt, browsers: {}, durations: {} };
      t.browsers[b] = status;
      t.durations[b] = pt.durations?.[b] ?? pt.durationMs ?? 0;
      byKey.set(id, t);
    }
  }
  for (const b of prev?.browsers ?? []) {
    if (ranNow.includes(b)) continue;
    // I summary vecchi non hanno "runs": usiamo i dati generali di quel run.
    runs[b] = prev.runs?.[b] ?? { startedAt: prev.startedAt, durationMs: prev.durationMs, trigger: prev.trigger, commit: prev.commit, runUrl: prev.runUrl };
  }
}

// Stato e durata complessivi di ogni controllo: il peggiore e il più lento tra i browser.
for (const t of byKey.values()) {
  t.status = Object.values(t.browsers).reduce((w, s) => (SEVERITY_OF_STATUS[s] > SEVERITY_OF_STATUS[w] ? s : w), "passed");
  t.durationMs = Math.max(0, ...Object.values(t.durations));
}

// Ordine di priorità: prima gli smoke, poi per severità (blocker → trivial), poi per area,
// poi per posizione esplicita ("order", es. ordine del menu) e infine per nome.
const TYPE_RANK = { smoke: 0, regression: 1 };
const SEVERITY_RANK = { blocker: 0, critical: 1, normal: 2, minor: 3, trivial: 4 };
const rank = (map, key) => map[key] ?? 99;

const tests = [...byKey.values()].sort(
  (a, b) =>
    rank(TYPE_RANK, a.type) - rank(TYPE_RANK, b.type) ||
    rank(SEVERITY_RANK, a.severity) - rank(SEVERITY_RANK, b.severity) ||
    (a.feature ?? "").localeCompare(b.feature ?? "") ||
    (a.order ?? 99) - (b.order ?? 99) ||
    a.title.localeCompare(b.title),
);
const browsers = ALL_BROWSERS.filter((b) => tests.some((t) => b in t.browsers));

// I totali contano le singole esecuzioni: 11 controlli x 4 browser = 44.
const statuses = tests.flatMap((t) => Object.values(t.browsers));
const count = (status) => statuses.filter((s) => s === status).length;
const total = statuses.length;
const passed = count("passed");
const current = runInfo(results);

function slowest(runsByBrowser) {
  const [browser, run] = Object.entries(runsByBrowser).reduce(
    (max, entry) => ((entry[1].durationMs ?? 0) > (max[1].durationMs ?? 0) ? entry : max),
    [null, { durationMs: 0 }],
  );
  return { slowestBrowser: browser, slowestDurationMs: run.durationMs ?? 0 };
}

const summary = {
  // I controlli "skipped" sono quelli bloccati dalla protezione anti-bot dell'hosting:
  // non verificabili, quindi non contano né come superati né come falliti.
  status: total > count("skipped") && count("failed") + count("broken") === 0 ? "passed" : "failed",
  total,
  passed,
  failed: count("failed"),
  broken: count("broken"),
  skipped: count("skipped"),
  successRate: total > count("skipped") ? Math.round((passed / (total - count("skipped"))) * 1000) / 10 : 0,
  checks: tests.length,
  browsers,
  ranNow, // i browser eseguiti in quest'ultimo run
  // I browser girano in parallelo, ognuno sulla sua macchina: la verifica dura quanto il più lento.
  // Usiamo la durata di ogni browser (non gli orari) perché i browser possono venire da run diversi.
  ...slowest(runs),
  // Dati dell'ultimo run (per tutti i browser vedi "runs").
  startedAt: current.startedAt,
  durationMs: current.durationMs,
  trigger: current.trigger,
  commit: current.commit,
  runUrl,
  runs,
  tests,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(summary, null, 2));
console.log(`summary.json: ${passed}/${total} superati (${summary.successRate}%) → ${outputFile}`);
