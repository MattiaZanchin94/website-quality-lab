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

const tests = results
  .map((r) => ({
    name: r.name,
    // Per i [TestCase] includiamo i parametri, es. "MenuItemOpensExpectedPage (Carriera)".
    title: r.parameters?.length ? `${r.name} (${r.parameters[0].value.replaceAll('"', "")})` : r.name,
    feature: label(r, "feature"),
    severity: label(r, "severity"),
    status: r.status, // passed | failed | broken | skipped
    durationMs: r.stop - r.start,
  }))
  .sort((a, b) => (a.feature ?? "").localeCompare(b.feature ?? "") || a.title.localeCompare(b.title));

const count = (status) => tests.filter((t) => t.status === status).length;
const total = tests.length;
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
