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
const browserOf = (r) => label(r, "browser") ?? "chromium";
// Verifica impedita dall'anti-bot dell'hosting (etichetta "antibot", vedi QualityLabTest): in Allure è Broken,
// ma non è un problema del sito. Nelle pagine (Playground e dashboard) la mostriamo come "non verificabile".
const statusOf = (r) => (label(r, "antibot") ? "skipped" : r.status);
// [Category("Security")] in C#: i controlli di sicurezza hanno il loro "campetto" nella pagina Playground.
// Label explain_* impostate nei test C# (vedi QualityLabTest): null se il controllo non ne ha.
const explainOf = (r) => {
  const it = { what: label(r, "explain_what"), why: label(r, "explain_why") };
  const en = { what: label(r, "explain_what_en"), why: label(r, "explain_why_en") };
  return it.what || en.what ? { it, en } : null;
};
// Campetto del controllo, dalla categoria NUnit (diventa un tag Allure): Security, Seo, Marketing hanno
// il loro campetto nella Playground; tutto il resto è Funzionalità.
const AREA_OF_TAG = { security: "security", seo: "seo", marketing: "marketing" };
const areaOf = (r) => {
  for (const l of r.labels ?? []) if (l.name === "tag" && AREA_OF_TAG[l.value.toLowerCase()]) return AREA_OF_TAG[l.value.toLowerCase()];
  return "functional";
};
// Campetti con una sola configurazione (Chromium) e una loro "ultima partita" (areaRuns).
const COURT_AREAS = ["security", "seo", "marketing"];

// Ogni controllo gira su più browser: raggruppiamo le esecuzioni per nome del controllo.
// Tutte le configurazioni: 4 browser per computer e 5 dispositivi emulati.
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
    Object.assign(existing, { title, en: { title: label(r, "name_en"), feature: label(r, "feature_en") }, order: Number(label(r, "order")) || null, explain: explainOf(r) });
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
    area: areaOf(r),
    // Spiegazione per i visitatori (finestra ⓘ nel Playground): cosa fa il controllo e perché conta.
    explain: explainOf(r),
    browsers: {}, // stato per browser, es. { chromium: "passed", firefox: "failed" }
    durations: {}, // durata in ms per browser
  };
  const browser = browserOf(r);
  t.browsers[browser] = statusOf(r);
  t.durations[browser] = r.stop - r.start;
  byKey.set(id, t);
}

// Le esecuzioni di questo run, per browser.
const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null;
// Durata totale dell'esecuzione su GitHub: dall'avvio (RUN_STARTED_AT, letto dal workflow)
// a ora, quando i risultati vengono pubblicati. Comprende preparazione delle macchine,
// compilazione, test e pubblicazione: è il tempo che aspetta chi avvia i controlli.
const runStartedAt = env.RUN_STARTED_AT ? Date.parse(env.RUN_STARTED_AT) : NaN;
const totalMs = Number.isFinite(runStartedAt) ? Math.max(0, Date.now() - runStartedAt) : null;

const runInfo = (rs) => ({
  startedAt: new Date(Math.min(...rs.map((r) => r.start))).toISOString(),
  // Dentro un browser i test sono sequenziali: la durata è la somma dei singoli test.
  durationMs: rs.reduce((sum, r) => sum + (r.stop - r.start), 0),
  totalMs,
  trigger: env.RUN_TRIGGER ?? "local",
  commit: env.GITHUB_SHA?.slice(0, 7) ?? null,
  runUrl,
});
const ranNow = [...new Set(results.map(browserOf))];

// Dati di esecuzione per browser (durata, avvio, chi l'ha avviata): solo dai controlli funzionali,
// così una partita di sicurezza (un minuto su Chromium) non cambia il grafico dei browser.
// La partita di sicurezza ha i suoi dati a parte, in "securityRun".
const functional = results.filter((r) => areaOf(r) === "functional");
const security = results.filter((r) => areaOf(r) === "security");
// Ultima partita di ogni campetto a sé (sicurezza, SEO, marketing): avvio, durata, chi l'ha avviata.
const areaRuns = Object.fromEntries(COURT_AREAS
  .map((a) => [a, results.filter((r) => areaOf(r) === a)])
  .filter(([, rs]) => rs.length)
  .map(([a, rs]) => [a, runInfo(rs)]));
const ranFunctional = [...new Set(functional.map(browserOf))];
const runs = Object.fromEntries(ranFunctional.map((b) => [b, runInfo(functional.filter((r) => browserOf(r) === b))]));
let securityRun = security.length ? runInfo(security) : null;

// Questo run ha coperto alcune combinazioni campetto + browser (es. "functional|iphone" o "security|chromium").
// Per tutte le altre teniamo gli ultimi risultati pubblicati: così una partita solo su iPhone,
// o solo di sicurezza, non cancella i risultati degli altri browser e dell'altro campetto.
const covered = new Set(results.map((r) => `${areaOf(r)}|${browserOf(r)}`));
const prev = previousFile ? JSON.parse(await readFile(previousFile, "utf8").catch(() => "null")) : null;
if (prev) {
  for (const pt of prev.tests ?? []) {
    const area = pt.area ?? "functional"; // i summary vecchi non hanno "area"
    for (const [b, status] of Object.entries(pt.browsers ?? {})) {
      if (covered.has(`${area}|${b}`) || !ALL_BROWSERS.includes(b)) continue;
      const id = pt.key ?? pt.title;
      const t = byKey.get(id) ?? { ...pt, area, browsers: {}, durations: {} };
      t.browsers[b] = status;
      t.durations[b] = pt.durations?.[b] ?? pt.durationMs ?? 0;
      byKey.set(id, t);
    }
  }
  for (const b of prev.browsers ?? []) {
    if (ranFunctional.includes(b) || !ALL_BROWSERS.includes(b)) continue;
    // I summary vecchi non hanno "runs": usiamo i dati generali di quel run.
    if (prev.runs?.[b] || !prev.runs) {
      runs[b] = prev.runs?.[b] ?? { startedAt: prev.startedAt, durationMs: prev.durationMs, trigger: prev.trigger, commit: prev.commit, runUrl: prev.runUrl };
    }
  }
  securityRun ??= prev.securityRun ?? null;
  for (const a of COURT_AREAS) areaRuns[a] ??= prev.areaRuns?.[a] ?? (a === "security" ? prev.securityRun : null) ?? undefined;
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
  // I browser girano in parallelo, ognuno sulla sua macchina: i test durano quanto il più lento
  // tra quelli eseguiti in quest'ultimo run (i risultati conservati da run precedenti non contano).
  // Una partita solo di sicurezza non ha browser "funzionali": teniamo il dato precedente.
  ...(ranFunctional.length
    ? slowest(Object.fromEntries(ranFunctional.map((b) => [b, runs[b]])))
    : { slowestBrowser: prev?.slowestBrowser ?? null, slowestDurationMs: prev?.slowestDurationMs ?? 0 }),
  // Dati dell'ultimo run (per tutti i browser vedi "runs").
  startedAt: current.startedAt,
  durationMs: current.durationMs,
  totalMs, // durata totale su GitHub (null se non disponibile)
  trigger: current.trigger,
  commit: current.commit,
  runUrl,
  runs,
  securityRun, // ultima partita del campetto Sicurezza (avvio, durata, chi l'ha avviata)
  areaRuns, // ultima partita di ogni campetto a sé: security, seo, marketing
  tests,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(summary, null, 2));
console.log(`summary.json: ${passed}/${total} superati (${summary.successRate}%) → ${outputFile}`);
