// Avviso su Telegram quando i controlli smoke (sito raggiungibile, menu) cambiano stato.
//
//   node scripts/notify.mjs <summary.json> [previous-summary.json]
//
// Manda un messaggio solo quando lo stato cambia:
//   verde → rosso: "🔴 problemi sul sito", con i controlli falliti e i browser coinvolti;
//   rosso → verde: "🟢 tutto di nuovo a posto".
// Se il problema dura ore non arriva un messaggio a ogni esecuzione oraria.
// I controlli "non verificabili" (CAPTCHA dell'hosting) non contano: non sono errori del sito.
//
// Variabili d'ambiente (secrets di GitHub):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  — se mancano, lo script non fa nulla.
//   ALERT_TEST=true                        — manda un messaggio di prova, per verificare la configurazione.
//   RUN_URL                                — link all'esecuzione su GitHub, aggiunto al messaggio.
import { readFile } from "node:fs/promises";

const [summaryFile, previousFile] = process.argv.slice(2);
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId, ALERT_TEST, RUN_URL } = process.env;
// Indirizzo dell'API di Telegram (sostituibile solo per provare lo script in locale con un server finto).
const API = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";
const SITE = "mattiazanchin.com";
const PLAYGROUND = "https://mattiazanchin.com/playground/";

const BROWSER_NAMES = {
  chromium: "Chrome",
  msedge: "Edge",
  firefox: "Firefox",
  webkit: "Safari",
  iphone: "iPhone",
  android: "Android",
  fold: "Galaxy Fold",
  ipad: "iPad verticale",
  ipadland: "iPad orizzontale",
};

const readJson = async (file) => (file ? JSON.parse(await readFile(file, "utf8").catch(() => "null")) : null);

// Controlli smoke falliti: per ognuno, i browser su cui non è passato.
function smokeFailures(summary) {
  return (summary?.tests ?? [])
    .filter((t) => t.type === "smoke")
    .map((t) => ({
      title: t.title,
      browsers: Object.entries(t.browsers ?? {})
        .filter(([, status]) => status === "failed" || status === "broken")
        .map(([b]) => BROWSER_NAMES[b] ?? b),
    }))
    .filter((t) => t.browsers.length > 0);
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

async function send(text) {
  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) {
    // Non stampiamo la risposta per intero: potrebbe contenere dettagli della configurazione.
    throw new Error(`Telegram ha risposto ${res.status}`);
  }
}

if (!token || !chatId) {
  console.log("Avvisi Telegram non configurati (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID): nessun messaggio.");
  process.exit(0);
}

const runLink = RUN_URL ? `\n\n<a href="${esc(RUN_URL)}">Dettagli dell'esecuzione</a>` : "";

if (ALERT_TEST === "true") {
  await send(`🏀 <b>Quality Lab</b>: prova degli avvisi riuscita.\nRiceverai un messaggio quando i controlli smoke di ${SITE} falliscono e quando tornano a posto.${runLink}`);
  console.log("Messaggio di prova inviato.");
  process.exit(0);
}

const now = smokeFailures(await readJson(summaryFile));
const before = smokeFailures(await readJson(previousFile));

if (now.length > 0 && before.length === 0) {
  const lines = now.map((t) => `• ${esc(t.title)} <i>(${esc(t.browsers.join(", "))})</i>`).join("\n");
  await send(`🔴 <b>${SITE}: problemi rilevati</b>\nControlli smoke non superati:\n${lines}\n\n<a href="${PLAYGROUND}">Apri il Playground</a>${runLink}`);
  console.log(`Avviso inviato: ${now.length} controlli smoke non superati.`);
} else if (now.length === 0 && before.length > 0) {
  await send(`🟢 <b>${SITE}: tutto di nuovo a posto</b>\nI controlli smoke sono tornati a passare.\n\n<a href="${PLAYGROUND}">Apri il Playground</a>${runLink}`);
  console.log("Avviso inviato: controlli smoke di nuovo verdi.");
} else {
  console.log(`Nessun cambio di stato (controlli smoke non superati: prima ${before.length}, ora ${now.length}): nessun messaggio.`);
}
