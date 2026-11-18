/* Quality Lab Playground – disegna i risultati e gestisce il pulsante "Avvia i controlli ora". */
(function () {
  "use strict";

  const cfg = window.QLP_CONFIG;
  const root = document.getElementById("qlp-root");
  if (!cfg || !root) return;

  const POLL_MS = 5000;
  const MAX_WAIT_MS = 8 * 60 * 1000;

  /* ---------- Lingua ---------- */

  // TranslatePress imposta <html lang="en-GB"> nella versione /en/ del sito.
  const LANG = (document.documentElement.lang || "it").toLowerCase().startsWith("en") ? "en" : "it";

  const TEXTS = {
    it: {
      loadError: "Al momento non è possibile caricare i risultati. Riprova tra poco.",
      siteOk: "Sito operativo",
      siteKo: "Problemi rilevati",
      lastRun: (ago, by) => `Ultima esecuzione ${ago}, avviata da ${by}`,
      triggers: {
        schedule: "esecuzione automatica oraria",
        push: "aggiornamento del codice",
        website: "un visitatore del sito",
        manual: "avvio manuale",
        local: "esecuzione locale",
      },
      checksPassed: "controlli superati",
      successRate: "tasso di successo",
      duration: "tempo di verifica",
      durationAll: "tempo di verifica (browser in parallelo)",
      durationAllMobile: "tempo di verifica (dispositivi in parallelo)",
      chartTitle: "Durata per browser",
      chartTitleMobile: "Durata per dispositivo",
      resultsTitle: "Risultati dell'ultima esecuzione",
      casesTitle: (n) => `Casi di test (${n})`,
      legendTypes: "Tipologia di test",
      legendPriorities: "Priorità",
      slowest: "il più lento",
      chartNote: "I browser vengono controllati contemporaneamente, ognuno su un computer separato: la verifica dura quanto il browser più lento.",
      chartNoteMobile: "I dispositivi vengono emulati contemporaneamente, ognuno su un computer separato: la verifica dura quanto il dispositivo più lento.",
      howTitle: "Come funziona?",
      close: "Chiudi",
      how: [
        "A ogni verifica GitHub Actions avvia un computer separato per ogni browser, e partono tutti insieme.",
        "Su ogni computer i controlli vengono eseguiti uno dopo l'altro, sempre nello stesso ordine.",
        "Per questo il tempo di verifica è quello del browser più lento, non la somma dei tempi.",
        "La lunghezza della barra indica solo il tempo; accanto a ogni browser trovi quanti controlli ha superato.",
        "I controlli riguardano la versione del sito per computer: Chrome, Edge, Firefox e Safari.",
      ],
      howMobile: [
        "A ogni verifica GitHub Actions avvia un computer separato per ogni dispositivo, e partono tutti insieme.",
        "I dispositivi sono emulati: lo stesso motore del browser (Safari per iPhone e iPad, Chrome per Android) con schermo, touch e identità di un iPhone 15, di un Pixel 7, di un iPad Pro 11 e di un Galaxy Z Fold 7 chiuso. Non sono dispositivi veri.",
        "Su ogni computer i controlli vengono eseguiti uno dopo l'altro, come farebbe una persona: sul telefono aprono anche il menu mobile del sito.",
        "Per questo il tempo di verifica è quello del dispositivo più lento, non la somma dei tempi.",
        "L'iPad viene provato sia in verticale sia in orizzontale; il Galaxy Fold solo nelle esecuzioni automatiche.",
      ],
      sections: { desktop: "💻 Computer", mobile: "📱 Smartphone e tablet" },
      sectionsLabel: "Scegli dove verificare il sito",
      // Varianti di ogni browser: il computer e i dispositivi emulati con lo stesso motore.
      variantNames: { chromium: "computer", android: "Android", fold: "Galaxy Fold chiuso", msedge: "computer", firefox: "computer", webkit: "computer", iphone: "iPhone", ipad: "iPad verticale", ipadland: "iPad orizzontale" },
      failedOn: (names) => `non superato su: ${names}`,
      mobileVisitor: "Stai usando uno smartphone o un tablet: i controlli non girano sul tuo dispositivo, ma su computer di GitHub, e verificano la versione del sito per computer.",
      mobileNote: "I controlli non girano sul tuo dispositivo: computer di GitHub emulano smartphone e tablet (schermo, touch e identità del dispositivo).",
      matrix: (checks, browsers) =>
        `${checks} controlli, ripetuti su ${browsers.length} browser per computer (${browsers.join(", ")})`,
      matrixMobile: (checks, devices) =>
        `${checks} controlli, ripetuti su ${devices.length} dispositivi emulati (${devices.join(", ")})`,
      engines: {
        chromium: "Google Chrome (motore Chromium): computer",
        msedge: "Microsoft Edge (motore Chromium): computer",
        firefox: "Firefox (motore Gecko): computer",
        webkit: "Safari (motore WebKit): computer",
        iphone: "iPhone 15 emulato, con il motore di Safari (WebKit)",
        android: "Pixel 7 (Android) emulato, con il motore di Chrome (Chromium)",
        ipad: "iPad Pro 11 emulato in verticale e in orizzontale, con il motore di Safari (WebKit)",
        fold: "Galaxy Z Fold 7 chiuso emulato, con il motore di Chrome (Chromium); solo nelle esecuzioni automatiche",
      },
      allBrowsers: "Tutti i browser",
      allDevices: "Tutti i dispositivi",
      autoOnly: "Solo nelle esecuzioni automatiche",
      tabsLabel: "Scegli il browser",
      tabsLabelMobile: "Scegli il dispositivo",
      noResults: "Nessun risultato ancora per questo browser: avvia i controlli per ottenerli.",
      runOn: (name) => `▶ Avvia i controlli su ${name}`,
      passed: "superato",
      notVerifiable: "non verificabile",
      blockedNote: (n) => `${n === 1 ? "1 controllo non verificabile" : `${n} controlli non verificabili`}: la protezione anti-bot dell'hosting ha bloccato il browser di test con un CAPTCHA. Non è un errore del sito.`,
      notPassed: "non superato",
      types: {
        smoke: ["Controllo essenziale: verifica che le funzioni principali del sito siano disponibili", "controlli essenziali, i primi a segnalare un problema"],
        regression: ["Controllo approfondito: verifica che le funzionalità esistenti continuino a funzionare", "controlli approfonditi sulle singole funzionalità"],
      },
      priorityFilter: "Priorità",
      allPriorities: "Tutte",
      priorities: {
        blocker: ["Se fallisce, il sito o una sua funzione principale non è utilizzabile", "se fallisce, il sito ha un problema serio"],
        major: ["Importante, ma un errore non impedisce di usare il sito", "importante, ma non blocca l'uso del sito"],
      },
      other: "Altro",
      runNow: "▶ Avvia i controlli ora",
      running: "Controlli in corso…",
      availableIn: (min) => `Disponibile tra ${min} min`,
      live: {
        starting: "Richiesta inviata",
        setup: "Preparazione dei browser",
        tests: (done, total) => `Verifica in corso: ${done} di ${total} controlli completati`,
        other: "Verifica in corso",
        publish: "Pubblicazione dei risultati",
        runningNow: "In esecuzione",
        on: "su",
        pending: "in attesa",
        running: "in esecuzione",
        progressLabel: "Avanzamento della verifica",
      },
      steps: {
        starting: "Richiesta inviata",
        queued: "Preparazione dell'ambiente di verifica",
        in_progress: "Verifica del sito in corso (circa 2–3 minuti)",
        refreshing: "Pubblicazione dei risultati",
      },
      msgFollowing: "C'è già una verifica in corso: non ne avviamo un'altra. Il pulsante tornerà disponibile quando sarà finita; intanto la seguiamo qui sotto.",
      msgAutoFollow: "È appena partita una verifica: la seguiamo in diretta qui sotto.",
      waiting: "In coda: c'è un'altra verifica in corso, questa partirà subito dopo",
      msgCooldown: (min) => `I controlli sono stati eseguiti da poco. Potrai riavviarli tra ${min} minuti.`,
      msgError: "Non è stato possibile avviare i controlli. Riprova più tardi.",
      msgSlow: "La verifica sta richiedendo più del previsto. Riprova a ricaricare la pagina tra qualche minuto.",
      msgDone: "Fatto! Ecco i risultati appena ottenuti.",
      msgDoneKo: "Verifica terminata: alcuni controlli non sono andati a buon fine.",
    },
    en: {
      loadError: "Results can't be loaded right now. Please try again shortly.",
      siteOk: "Site operational",
      siteKo: "Issues detected",
      lastRun: (ago, by) => `Last run ${ago}, started by ${by}`,
      triggers: {
        schedule: "the hourly automatic run",
        push: "a code update",
        website: "a site visitor",
        manual: "a manual start",
        local: "a local run",
      },
      checksPassed: "checks passed",
      successRate: "success rate",
      duration: "check duration",
      durationAll: "check time (browsers in parallel)",
      durationAllMobile: "check time (devices in parallel)",
      chartTitle: "Duration per browser",
      chartTitleMobile: "Duration per device",
      resultsTitle: "Latest run results",
      casesTitle: (n) => `Test cases (${n})`,
      legendTypes: "Test type",
      legendPriorities: "Priority",
      slowest: "the slowest",
      chartNote: "The browsers are checked at the same time, each on a separate computer: the run lasts as long as the slowest browser.",
      chartNoteMobile: "The devices are emulated at the same time, each on a separate computer: the run lasts as long as the slowest device.",
      howTitle: "How does it work?",
      close: "Close",
      how: [
        "For every run, GitHub Actions starts a separate computer for each browser, and they all start together.",
        "On each computer the checks run one after another, always in the same order.",
        "That's why the check time is the one of the slowest browser, not the sum of the times.",
        "A bar's length shows only the time; next to each browser you'll find how many checks it passed.",
        "The checks cover the desktop version of the site: Chrome, Edge, Firefox and Safari.",
      ],
      howMobile: [
        "For every run, GitHub Actions starts a separate computer for each device, and they all start together.",
        "The devices are emulated: the same browser engine (Safari for iPhone and iPad, Chrome for Android) with the screen, touch and identity of an iPhone 15, a Pixel 7, an iPad Pro 11 and a folded Galaxy Z Fold 7. They are not real devices.",
        "On each computer the checks run one after another, like a person would: on phones they also open the site's mobile menu.",
        "That's why the check time is the one of the slowest device, not the sum of the times.",
        "The iPad is tested both in portrait and in landscape; the Galaxy Fold only in the automatic runs.",
      ],
      sections: { desktop: "💻 Desktop", mobile: "📱 Phones and tablets" },
      sectionsLabel: "Choose where to check the site",
      variantNames: { chromium: "computer", android: "Android", fold: "folded Galaxy Fold", msedge: "computer", firefox: "computer", webkit: "computer", iphone: "iPhone", ipad: "iPad portrait", ipadland: "iPad landscape" },
      failedOn: (names) => `not passed on: ${names}`,
      mobileVisitor: "You're on a smartphone or tablet: the checks don't run on your device but on GitHub computers, and they check the desktop version of the site.",
      mobileNote: "The checks don't run on your device: GitHub computers emulate phones and tablets (screen, touch and device identity).",
      matrix: (checks, browsers) =>
        `${checks} checks, repeated on ${browsers.length} desktop browsers (${browsers.join(", ")})`,
      matrixMobile: (checks, devices) =>
        `${checks} checks, repeated on ${devices.length} emulated devices (${devices.join(", ")})`,
      engines: {
        chromium: "Google Chrome (Chromium engine): computer",
        msedge: "Microsoft Edge (Chromium engine): computer",
        firefox: "Firefox (Gecko engine): computer",
        webkit: "Safari (WebKit engine): computer",
        iphone: "Emulated iPhone 15, with Safari's engine (WebKit)",
        android: "Emulated Pixel 7 (Android), with Chrome's engine (Chromium)",
        ipad: "Emulated iPad Pro 11 in portrait and landscape, with Safari's engine (WebKit)",
        fold: "Emulated folded Galaxy Z Fold 7, with Chrome's engine (Chromium); automatic runs only",
      },
      allBrowsers: "All browsers",
      allDevices: "All devices",
      autoOnly: "Automatic runs only",
      tabsLabel: "Choose the browser",
      tabsLabelMobile: "Choose the device",
      noResults: "No results yet for this browser: run the checks to get them.",
      runOn: (name) => `▶ Run the checks on ${name}`,
      passed: "passed",
      notVerifiable: "not verifiable",
      blockedNote: (n) => `${n === 1 ? "1 check" : `${n} checks`} could not be verified: the host's anti-bot protection blocked the test browser with a CAPTCHA. This is not a site error.`,
      notPassed: "not passed",
      types: {
        smoke: ["Essential check: verifies that the site's main functions are available", "essential checks, the first to flag a problem"],
        regression: ["In-depth check: verifies that existing features keep working", "in-depth checks on individual features"],
      },
      priorityFilter: "Priority",
      allPriorities: "All",
      priorities: {
        blocker: ["If it fails, the site or one of its main functions can't be used", "if it fails, the site has a serious problem"],
        major: ["Important, but a failure doesn't stop people from using the site", "important, but doesn't block the site"],
      },
      other: "Other",
      runNow: "▶ Run the checks now",
      running: "Checks in progress…",
      availableIn: (min) => `Available in ${min} min`,
      live: {
        starting: "Request sent",
        setup: "Preparing the browsers",
        tests: (done, total) => `Checking the site: ${done} of ${total} checks done`,
        other: "Check in progress",
        publish: "Publishing the results",
        runningNow: "Running",
        on: "on",
        pending: "waiting",
        running: "running",
        progressLabel: "Run progress",
      },
      steps: {
        starting: "Request sent",
        queued: "Preparing the test environment",
        in_progress: "Checking the site (about 2–3 minutes)",
        refreshing: "Publishing the results",
      },
      msgFollowing: "A run is already in progress, so we didn't start another one. The button will be available again when it ends; meanwhile we're following it below.",
      msgAutoFollow: "A run has just started: we're following it live below.",
      waiting: "Queued: another run is in progress, this one will start right after",
      msgCooldown: (min) => `The checks ran a moment ago. You can start them again in ${min} minutes.`,
      msgError: "The checks couldn't be started. Please try again later.",
      msgSlow: "The run is taking longer than expected. Try reloading the page in a few minutes.",
      msgDone: "Done! Here are the fresh results.",
      msgDoneKo: "Run finished: some checks did not pass.",
    },
  };
  const T = TEXTS[LANG];

  const state = {
    summary: null,
    status: null,
    phase: "idle", // idle | starting | queued | in_progress | refreshing
    section: "desktop", // "desktop" (browser per computer) oppure "mobile" (dispositivi emulati)
    view: "all", // scheda selezionata: "all" oppure un browser o dispositivo della sezione
    priority: "all", // filtro dei controlli: "all", "blocker" oppure "major"
    message: null,
    messageKind: "info", // "info" oppure "warning" (avviso evidenziato)
    following: false, // true mentre la pagina segue un'esecuzione
    waiting: false, // true se l'esecuzione seguita è in coda dietro un'altra
    justUpdated: false,
  };

  /* ---------- Dati ---------- */

  async function getJson(url, options) {
    const res = await fetch(url, Object.assign({ cache: "no-store" }, options));
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  }

  // GitHub Pages tiene i file in cache per qualche minuto: il parametro ?t= forza la versione aggiornata.
  const loadSummary = async () => (await getJson(cfg.summaryUrl + "?t=" + Date.now())).body;
  const loadStatus = async () => (await getJson(cfg.statusUrl)).body;

  // Testo nella lingua della pagina, con l'italiano come riserva se manca la traduzione.
  const titleOf = (t) => (LANG === "en" && t.en && t.en.title) || t.title;
  const featureOf = (t) => (LANG === "en" && t.en && t.en.feature) || t.feature || T.other;

  /* ---------- Formattazione ---------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const rtf = new Intl.RelativeTimeFormat(LANG, { numeric: "auto" });
  function timeAgo(iso) {
    const sec = Math.round((new Date(iso) - Date.now()) / 1000);
    const abs = Math.abs(sec);
    if (abs < 60) return rtf.format(sec, "second");
    if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
    return rtf.format(Math.round(sec / 86400), "day");
  }

  const seconds = (ms) => (ms / 1000).toLocaleString(LANG, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " s";

  // Tempo totale in minuti e secondi, es. "2 min 14 s".
  function minutes(ms) {
    const total = Math.round(ms / 1000);
    return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
  }

  // I browser girano in parallelo: nella vista "tutti i browser" il tempo è quello del più lento
  // (i summary più vecchi non hanno slowestDurationMs: lo ricaviamo da "runs").
  function totalDuration(s) {
    if (s.slowestDurationMs) return s.slowestDurationMs;
    const runs = Object.values(s.runs || {});
    return runs.length ? Math.max(...runs.map((r) => r.durationMs || 0)) : s.durationMs;
  }

  // Grafico a barre: una barra per browser, tutte da zero, lunghezza proporzionale alla durata.
  function renderChart(s) {
    const rows = Object.keys(BROWSER_NAMES)
      .filter((b) => s.runs && s.runs[b] && s.runs[b].durationMs)
      .map((b) => {
        const statuses = s.tests.filter((t) => t.browsers && b in t.browsers).map((t) => t.browsers[b]);
        return {
          b,
          ms: s.runs[b].durationMs,
          passed: statuses.filter((st) => st === "passed").length,
          verified: statuses.filter((st) => st !== "skipped").length,
          ok: statuses.every(isOk),
        };
      });
    if (rows.length < 2) return "";
    const max = Math.max(...rows.map((r) => r.ms));
    return `<div class="qlp-chart">
      <h4>${esc(isMobileSection() ? T.chartTitleMobile : T.chartTitle)}</h4>
      ${rows
        .map(
          (r) => `<div class="qlp-bar-row">
            <span class="qlp-bar-name">${BROWSER_NAMES[r.b]}</span>
            <span class="qlp-bar-track"><span class="qlp-bar ${r.ms === max ? "qlp-bar-slowest" : ""}" style="width:${Math.max(4, (r.ms / max) * 100).toFixed(1)}%"></span></span>
            <span class="qlp-bar-value">
              <span class="qlp-res ${r.ok ? "qlp-ok" : "qlp-ko"}">${r.ok ? "✓" : "✗"} ${r.passed}/${r.verified}</span>
              ${minutes(r.ms)}${r.ms === max ? ` · <em>${esc(T.slowest)}</em>` : ""}
            </span>
          </div>`,
        )
        .join("")}
      <p class="qlp-chart-note">${esc(isMobileSection() ? T.chartNoteMobile : T.chartNote)}</p>
      <button type="button" class="qlp-how-link" aria-haspopup="dialog">${esc(T.howTitle)}</button>
    </div>`;
  }

  // "skipped" = bloccato dalla protezione anti-bot: non verificabile, ma non è un errore del sito.
  const isOk = (status) => status === "passed" || status === "skipped";

  const STATUS_ICON = { passed: "✓", failed: "✗", broken: "!", skipped: "–" };

  // Due sezioni: i browser per computer e i dispositivi emulati. Ogni voce mostrata (scheda, badge,
  // riga del grafico) raggruppa una o più configurazioni di summary.json: l'iPad comprende
  // verticale e orizzontale. Nomi brevi per schede e badge; il tooltip (T.engines) li spiega.
  const SECTIONS = {
    desktop: {
      names: { chromium: "Chrome", msedge: "Edge", firefox: "Firefox", webkit: "Safari" },
      families: { chromium: ["chromium"], msedge: ["msedge"], firefox: ["firefox"], webkit: ["webkit"] },
      // Valore da inviare per avviare i controlli ("all" = tutta la sezione).
      run: { all: "desktop", chromium: "chromium", msedge: "msedge", firefox: "firefox", webkit: "webkit" },
    },
    mobile: {
      names: { iphone: "iPhone", android: "Android", ipad: "iPad", fold: "Galaxy Fold" },
      families: { iphone: ["iphone"], android: ["android"], ipad: ["ipad", "ipadland"], fold: ["fold"] },
      // Il Galaxy Fold gira solo nelle esecuzioni automatiche: niente pulsante.
      run: { all: "mobile", iphone: "iphone", android: "android", ipad: "ipad" },
    },
  };
  let BROWSER_NAMES, FAMILIES, FAMILY_OF, RUN_KEY;
  function setSection(section) {
    state.section = section;
    ({ names: BROWSER_NAMES, families: FAMILIES, run: RUN_KEY } = SECTIONS[section]);
    FAMILY_OF = Object.fromEntries(Object.entries(FAMILIES).flatMap(([f, vs]) => vs.map((v) => [v, f])));
  }
  const isMobileSection = () => state.section === "mobile";

  // Dispositivo di chi visita: iPhone, iPad (anche quando Safari si presenta come Mac) o Android.
  // Apre la sezione e la scheda corrispondenti; gli altri dispositivi partono dalla sezione Computer.
  function detectDevice() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPod/.test(ua)) return ["mobile", "iphone"];
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return ["mobile", "ipad"];
    if (/Android/.test(ua)) return ["mobile", "android"];
    return ["desktop", "all"];
  }

  // Esito di un browser a partire dalle sue varianti: un fallimento vince; i controlli bloccati
  // dal CAPTCHA contano solo se nessuna variante è stata verificata.
  function combine(statuses) {
    if (statuses.includes("failed")) return "failed";
    if (statuses.includes("broken")) return "broken";
    if (statuses.includes("passed")) return "passed";
    return "skipped";
  }
  // Esito complessivo di un controllo su tutti i browser: il peggiore.
  function worst(statuses) {
    const rank = { passed: 0, skipped: 1, broken: 2, failed: 3 };
    return statuses.reduce((w, s) => ((rank[s] ?? 0) > (rank[w] ?? 0) ? s : w), "passed");
  }

  // Trasforma summary.json (una voce per variante) nella vista per browser mostrata nella pagina.
  function groupByBrowser(s) {
    if (!s || !s.tests) return s;
    const present = s.browsers || [];
    const fams = Object.keys(FAMILIES).filter((f) => FAMILIES[f].some((v) => present.includes(v)));
    const tests = s.tests.map((t) => {
      const browsers = {};
      const durations = {};
      const failedVariants = {};
      for (const f of fams) {
        const vs = FAMILIES[f].filter((v) => t.browsers && v in t.browsers);
        if (!vs.length) continue;
        browsers[f] = combine(vs.map((v) => t.browsers[v]));
        durations[f] = Math.max(0, ...vs.map((v) => (t.durations && t.durations[v]) || 0));
        failedVariants[f] = vs.filter((v) => ["failed", "broken"].includes(t.browsers[v]));
      }
      return { ...t, browsers, durations, failedVariants, status: worst(Object.values(browsers)) };
    });
    const runs = {};
    for (const f of fams) {
      const vr = FAMILIES[f].map((v) => s.runs && s.runs[v]).filter(Boolean);
      if (!vr.length) continue;
      const latest = vr.reduce((a, b) => (new Date(b.startedAt) > new Date(a.startedAt) ? b : a));
      runs[f] = { ...latest, durationMs: Math.max(...vr.map((r) => r.durationMs || 0)) };
    }
    const all = tests.flatMap((t) => Object.values(t.browsers));
    const count = (x) => all.filter((y) => y === x).length;
    const skipped = count("skipped");
    const verified = all.length - skipped;
    const slowest = Object.values(runs).reduce((m, r) => Math.max(m, r.durationMs || 0), 0);
    // Ultima esecuzione che ha toccato questa sezione (es. solo i dispositivi, avviata da un visitatore).
    const latestRun = Object.values(runs).reduce((a, b) => (!a || new Date(b.startedAt) > new Date(a.startedAt) ? b : a), null);
    return {
      ...s,
      startedAt: (latestRun && latestRun.startedAt) || s.startedAt,
      trigger: (latestRun && latestRun.trigger) || s.trigger,
      tests,
      runs,
      browsers: fams,
      total: all.length,
      passed: count("passed"),
      failed: count("failed"),
      broken: count("broken"),
      skipped,
      successRate: verified ? Math.round((count("passed") / verified) * 1000) / 10 : 0,
      status: verified && count("failed") + count("broken") === 0 ? "passed" : "failed",
      slowestDurationMs: slowest || s.slowestDurationMs,
    };
  }
  // Il visitatore usa uno smartphone o un tablet? (schermo stretto o puntamento con il dito)
  const isMobileVisitor = () =>
    window.matchMedia("(max-width: 900px)").matches || window.matchMedia("(pointer: coarse)").matches;
  const TYPE_NAMES = { smoke: "Smoke", regression: "Regression" };

  function renderType(type) {
    if (!TYPE_NAMES[type]) return "";
    return ` <span class="qlp-type qlp-type-${esc(type)}" title="${esc(T.types[type][0])}">${TYPE_NAMES[type]}</span>`;
  }

  const PRIORITY_NAMES = { blocker: "Blocker", major: "Major" };
  const priorityOf = (t) => (t.priority === "blocker" ? "blocker" : "major");

  function renderPriority(priority) {
    return `<span class="qlp-prio qlp-prio-${priority}" title="${esc(T.priorities[priority][0])}">${PRIORITY_NAMES[priority]}</span>`;
  }

  // Filtro per priorità: Tutte / Blocker / Major, con il numero di controlli di ciascuna.
  function renderPriorityFilter(tests) {
    if (!tests.some((t) => t.priority)) return "";
    const options = [["all", T.allPriorities], ["blocker", PRIORITY_NAMES.blocker], ["major", PRIORITY_NAMES.major]];
    return `<div class="qlp-filter" role="group" aria-label="${esc(T.priorityFilter)}">
      <span class="qlp-filter-label">${esc(T.priorityFilter)}:</span>
      ${options
        .map(([key, name]) => {
          const n = key === "all" ? tests.length : tests.filter((t) => priorityOf(t) === key).length;
          return `<button type="button" class="qlp-filter-btn" data-priority="${key}" aria-pressed="${state.priority === key}">${esc(name)} <span class="qlp-count">${n}</span></button>`;
        })
        .join("")}
    </div>`;
  }

  // Legenda come elenco: un tipo o una priorità per riga, con la sua spiegazione.
  // Legenda in due gruppi con il loro titolo: tipologia di test e priorità.
  function renderLegend(s) {
    const groups = [];
    if (s.tests.some((t) => TYPE_NAMES[t.type])) {
      groups.push([T.legendTypes, [[renderType("smoke"), T.types.smoke[1]], [renderType("regression"), T.types.regression[1]]]]);
    }
    if (s.tests.some((t) => t.priority)) {
      groups.push([T.legendPriorities, [[renderPriority("blocker"), T.priorities.blocker[1]], [renderPriority("major"), T.priorities.major[1]]]]);
    }
    if (!groups.length) return "";
    return `<div class="qlp-legend">${groups
      .map(
        ([title, items]) => `<div class="qlp-legend-group">
          <h5>${esc(title)}</h5>
          <ul>${items.map(([chip, text]) => `<li>${chip}<span>${esc(text)}</span></li>`).join("")}</ul>
        </div>`,
      )
      .join("")}</div>`;
  }



  // Accanto a ogni controllo: i 4 browser. Il tooltip dice cosa comprende ciascuno e,
  // se qualcosa non va, su quale variante (es. "non superato su: iPhone").
  function renderBrowsers(t, info) {
    if (!t.browsers) return "";
    return `<span class="qlp-browsers">${Object.keys(BROWSER_NAMES)
      .filter((f) => f in t.browsers || (info && info.families.includes(f)))
      .map((f) => {
        // Durante un'esecuzione mostriamo lo stato in diretta, altrimenti l'ultimo risultato.
        const st = liveStateOf(info, t, f) || t.browsers[f];
        const word = { passed: T.passed, skipped: T.notVerifiable, pending: T.live.pending, running: T.live.running }[st] || T.notPassed;
        const failed = (t.failedVariants && t.failedVariants[f]) || [];
        // Se qualcosa non va, il tooltip dice su quale variante (es. "non superato su: iPhone").
        const detail = failed.length && FAMILIES[f].length > 1 && !["pending", "running"].includes(st) ? T.failedOn(failed.map((v) => T.variantNames[v]).join(", ")) : word;
        return `<span class="qlp-b qlp-b-${esc(st)}" title="${esc(`${T.engines[f]} · ${detail}`)}">${BROWSER_NAMES[f]}</span>`;
      })
      .join("")}</span>`;
  }



  // Finestra modale "Come funziona?": creata una sola volta e aggiunta a <body>,
  // così non si chiude quando il riquadro viene ridisegnato durante un'esecuzione.
  let dialog = null;
  function howDialog() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "qlp qlp-modal";
      dialog.setAttribute("aria-labelledby", "qlp-how-title");
      dialog.setAttribute("data-no-translation", ""); // le traduzioni le gestiamo noi, non TranslatePress
      // Un clic sullo sfondo scuro (fuori dal contenuto) chiude la finestra; Esc la chiude già da solo.
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.close();
      });
      document.body.appendChild(dialog);
    }
    // Il testo dipende dalla sezione aperta (computer o dispositivi emulati).
    const lines = isMobileSection() ? T.howMobile : T.how;
    dialog.innerHTML = `
      <h3 id="qlp-how-title">${esc(T.howTitle)}</h3>
      <ul>${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      <form method="dialog"><button type="submit" class="qlp-run">${esc(T.close)}</button></form>`;
    return dialog;
  }

  /* ---------- Avanzamento in diretta ---------- */
  // Durante un'esecuzione i test comunicano a WordPress "iniziato / superato / fallito" (status.progress).
  // Da qui ricaviamo lo stato di ogni controllo e una barra che si riempie in modo continuo,
  // agganciata ai dati reali: non supera mai il punto successivo e non torna mai indietro.

  const ALL_TEST_BROWSERS = ["chromium", "msedge", "firefox", "webkit", "iphone", "android", "fold", "ipad", "ipadland"];
  const SETUP_MS = 75000; // durata tipica della preparazione dei browser su GitHub
  const PUBLISH_MS = 30000; // durata tipica della pubblicazione dei risultati
  const live = { seen: {}, allDoneAt: null, shown: 0, target: 0, startedAt: 0, since: 0, lastFrame: 0 };

  // "since": l'esecuzione da seguire è quella creata dopo questo istante (non quella precedente, già finita).
  function resetLive(since) {
    live.seen = {};
    live.allDoneAt = null;
    live.shown = 0;
    live.target = 0;
    live.startedAt = Date.now();
    live.since = since || 0;
  }

  // L'esecuzione nello stato è quella che stiamo seguendo?
  const isFollowedRun = (run) => run && new Date(run.createdAt).getTime() >= live.since;

  // Varianti coinvolte nell'esecuzione, dal titolo (es. "E2E · website · safari"); altrimenti tutte.
  function runBrowsers(run) {
    const m = run && run.title && run.title.match(/·\s*([a-z]+)\s*$/);
    if (!m) return ALL_TEST_BROWSERS;
    if (m[1] === "desktop") return Object.values(SECTIONS.desktop.families).flat();
    if (m[1] === "mobile") return ["iphone", "android", "ipad", "ipadland"]; // il Fold solo in automatico
    if (m[1] === "ipad") return SECTIONS.mobile.families.ipad;
    return ALL_TEST_BROWSERS.includes(m[1]) ? [m[1]] : ALL_TEST_BROWSERS;
  }

  function liveInfo() {
    const st = state.status;
    if (!state.following || !st || !isFollowedRun(st.run) || !state.summary) return null;
    const browsers = runBrowsers(st.run);
    const progress = st.progress || {};
    const tests = state.summary.tests.filter((t) => t.key);
    const now = Date.now();
    let done = 0;
    let partial = 0;
    const current = [];
    for (const b of browsers) {
      const p = progress[b] || { tests: {} };
      for (const t of tests) {
        const s = p.tests[t.key];
        if (s && s !== "running") done++;
        if (s === "running") {
          const id = b + "|" + t.key;
          live.seen[id] = live.seen[id] || now;
          const expected = (t.durations && t.durations[b]) || 3000;
          partial += Math.min(0.9, (now - live.seen[id]) / expected); // il test in corso conta in parte
          current.push({ b, t });
        }
      }
    }
    const total = tests.length * browsers.length;
    // Per il testo: un controllo è completato su un browser quando lo è su tutte le sue varianti.
    const families = Object.keys(FAMILIES).filter((f) => FAMILIES[f].some((v) => browsers.includes(v)));
    const info = { browsers, families, progress, done, partial, total, current, hasData: Object.keys(progress).length > 0 };
    info.checksTotal = tests.length * families.length;
    info.checksDone = tests.reduce(
      (n, t) => n + families.filter((f) => !["pending", "running"].includes(liveStateOf(info, t, f))).length,
      0,
    );
    return info;
  }

  // Percentuale "vera" verso cui la barra si muove.
  function liveTarget(info) {
    const now = Date.now();
    if (state.phase === "refreshing") return 100; // esecuzione finita, risultati in arrivo
    if (!info || info.done + info.current.length === 0) {
      // Richiesta inviata e preparazione dei browser: 2% → 14% nel tempo tipico.
      return Math.min(14, 2 + ((now - live.startedAt) / SETUP_MS) * 12);
    }
    if (info.done < info.total) {
      live.allDoneAt = null;
      return 15 + 80 * ((info.done + info.partial) / info.total); // controlli: 15% → 95%
    }
    live.allDoneAt = live.allDoneAt || now;
    return Math.min(99, 95 + ((now - live.allDoneAt) / PUBLISH_MS) * 4); // pubblicazione: 95% → 99%
  }

  function livePhaseText(info) {
    if (state.phase === "starting") return T.live.starting;
    if (state.phase === "refreshing") return T.live.publish;
    if (state.waiting) return T.waiting;
    if (!info || info.done + info.current.length === 0) return T.live.setup;
    if (info.done >= info.total) return T.live.publish;
    // L'esecuzione riguarda solo l'altra sezione: niente conteggio dei controlli di questa.
    if (!info.checksTotal) return T.live.other;
    return T.live.tests(info.checksDone, info.checksTotal);
  }

  function renderLiveProgress() {
    if (state.phase === "idle") return "";
    const info = liveInfo();
    const pct = Math.round(live.shown);
    const now = info && info.current.length
      ? `<p class="qlp-live-now"><span class="qlp-pulse"></span>${esc(T.live.runningNow)}: ${info.current
          .filter((c) => FAMILY_OF[c.b]) // solo le configurazioni della sezione aperta
          .slice(0, 2)
          .filter((c, i, all) => all.findIndex((x) => x.t === c.t && FAMILY_OF[x.b] === FAMILY_OF[c.b]) === i)
          .map((c) => `«${esc(titleOf(c.t))}» ${esc(T.live.on)} ${BROWSER_NAMES[FAMILY_OF[c.b]]}`)
          .join(" · ")}</p>`
      : "";
    return `<div class="qlp-live">
      <div class="qlp-live-head"><span class="qlp-live-phase">${esc(livePhaseText(info))}</span><span class="qlp-live-pct">${pct}%</span></div>
      <div class="qlp-live-track" role="progressbar" aria-label="${esc(T.live.progressLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <span class="qlp-live-fill" style="width:${live.shown.toFixed(2)}%"></span>
      </div>
      ${now}
    </div>`;
  }

  // Animazione continua: a ogni passo la barra si avvicina al valore vero, senza mai tornare indietro.
  function tick() {
    if (state.phase === "idle") return;
    const info = liveInfo();
    live.target = Math.max(live.target, liveTarget(info));
    const now = Date.now();
    const dt = now - live.lastFrame; // millisecondi dall'ultimo aggiornamento
    if (dt > 1000) {
      // La pagina non veniva aggiornata (scheda nascosta, telefono bloccato, animazioni sospese):
      // nessuno ha visto la barra, quindi si porta subito al valore vero.
      live.shown = live.target;
    } else {
      // Velocità basata sul tempo (uguale a 60 o a 4 aggiornamenti al secondo):
      // al massimo 9 punti al secondo, così anche un salto del valore vero diventa uno scorrimento.
      const gap = live.target - live.shown;
      const step = Math.max(0.0018 * dt, Math.min(0.009 * dt, gap * 0.002 * dt));
      live.shown = Math.min(live.target, live.shown + step);
    }
    live.lastFrame = now;
    const fill = root.querySelector(".qlp-live-fill");
    const pct = root.querySelector(".qlp-live-pct");
    const bar = root.querySelector(".qlp-live-track");
    if (fill) fill.style.width = live.shown.toFixed(2) + "%";
    if (pct) pct.textContent = Math.round(live.shown) + "%";
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(live.shown)));
  }

  function animate() {
    tick();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // Riserva: se il browser sospende requestAnimationFrame, un timer aggiorna comunque la barra.
  setInterval(() => {
    if (Date.now() - live.lastFrame > 500) tick();
  }, 250);

  // Stato in diretta di un controllo su un browser (e le sue varianti):
  // running se una variante è in corso, pending se una deve ancora partire, altrimenti l'esito. Null se fuori dall'esecuzione.
  function liveStateOf(info, t, f) {
    if (!info || !t.key) return null;
    const vs = (FAMILIES[f] || [f]).filter((v) => info.browsers.includes(v));
    if (!vs.length) return null;
    const states = vs.map((v) => (info.progress[v] && info.progress[v].tests[t.key]) || "pending");
    if (states.includes("running")) return "running";
    if (states.includes("pending")) return "pending";
    return combine(states);
  }

  /* ---------- Render ---------- */

  // Vista dei dati per la scheda selezionata: tutti i browser oppure uno solo.
  function viewData(s) {
    const v = state.view;
    if (v === "all") {
      return {
        tests: s.tests,
        passed: s.passed,
        skipped: s.skipped || 0,
        total: s.total,
        successRate: s.successRate,
        durationMs: totalDuration(s),
        startedAt: s.startedAt,
        trigger: s.trigger,
        status: s.status,
      };
    }
    const tests = s.tests.filter((t) => t.browsers && v in t.browsers);
    const passed = tests.filter((t) => t.browsers[v] === "passed").length;
    const skipped = tests.filter((t) => t.browsers[v] === "skipped").length;
    const verified = tests.length - skipped;
    const run = (s.runs && s.runs[v]) || {};
    return {
      tests,
      passed,
      skipped,
      total: tests.length,
      successRate: verified ? Math.round((passed / verified) * 1000) / 10 : 0,
      durationMs: run.durationMs ?? 0,
      startedAt: run.startedAt ?? s.startedAt,
      trigger: run.trigger ?? s.trigger,
      status: verified && passed === verified ? "passed" : "failed",
    };
  }

  // Scelta della sezione: computer oppure smartphone e tablet.
  function renderSections() {
    return `<div class="qlp-sections" role="group" aria-label="${esc(T.sectionsLabel)}">${Object.keys(SECTIONS)
      .map(
        (key) =>
          `<button type="button" class="qlp-section" data-section="${key}" aria-pressed="${state.section === key}">${esc(T.sections[key])}</button>`,
      )
      .join("")}</div>`;
  }

  function renderTabs(s) {
    const known = Object.keys(BROWSER_NAMES);
    const tabs = [["all", isMobileSection() ? T.allDevices : T.allBrowsers], ...known.map((b) => [b, BROWSER_NAMES[b]])];
    return `<div class="qlp-tabs" role="tablist" aria-label="${esc(isMobileSection() ? T.tabsLabelMobile : T.tabsLabel)}">${tabs
      .map(([key, name]) => {
        const selected = state.view === key;
        // Pallino colorato con l'esito di quel browser (nessuno se non ha ancora risultati).
        let dot = "";
        if (key !== "all" && s.tests.some((t) => t.browsers && key in t.browsers)) {
          const ok = s.tests.every((t) => !t.browsers || !(key in t.browsers) || isOk(t.browsers[key]));
          dot = `<span class="qlp-tab-dot ${ok ? "qlp-ok" : "qlp-ko"}"></span>`;
        }
        const hint = key === "all" ? "" : ` title="${esc(T.engines[key])}"`;
        return `<button type="button" role="tab" class="qlp-tab" data-view="${esc(key)}" aria-selected="${selected}"${hint}>${dot}${esc(name)}</button>`;
      })
      .join("")}</div>`;
  }

  function renderStatus(t) {
    // Nella scheda di un singolo browser mostriamo lo stato di quel browser, altrimenti quello visibile.
    const st = state.view === "all" ? t.status : t.browsers[state.view];
    const ms = state.view === "all" ? t.durationMs : (t.durations && t.durations[state.view]) ?? t.durationMs;
    return { st, ms };
  }

  function render() {
    const s = groupByBrowser(state.summary); // vista per browser (i dispositivi dentro il loro browser)
    if (!s) {
      root.innerHTML = `<p class="qlp-error">${esc(T.loadError)}</p>`;
      return;
    }

    const d = viewData(s);
    const info = liveInfo(); // null se non c'è un'esecuzione in corso
    const ok = d.status === "passed";
    const byFeature = {};
    const listed = state.priority === "all" ? d.tests : d.tests.filter((t) => priorityOf(t) === state.priority);
    for (const t of listed) (byFeature[featureOf(t)] ||= []).push(t);

    const body = d.tests.length
      ? `
        <h3 class="qlp-results-title">${esc(T.resultsTitle)}</h3>
        <div class="qlp-head">
          <span class="qlp-pill ${ok ? "qlp-ok" : "qlp-ko"}">
            <span class="qlp-dot"></span>${esc(ok ? T.siteOk : T.siteKo)}
          </span>
          <span class="qlp-meta">${esc(T.lastRun(timeAgo(d.startedAt), T.triggers[d.trigger] || d.trigger))}</span>
        </div>

        <div class="qlp-stats">
          <div class="qlp-stat"><span class="qlp-num">${d.passed}/${d.total}</span><span class="qlp-label">${esc(T.checksPassed)}</span></div>
          <div class="qlp-stat"><span class="qlp-num">${d.successRate.toLocaleString(LANG)}%</span><span class="qlp-label">${esc(T.successRate)}</span></div>
          <div class="qlp-stat"><span class="qlp-num">${minutes(d.durationMs)}</span><span class="qlp-label">${esc(state.view === "all" ? (isMobileSection() ? T.durationAllMobile : T.durationAll) : T.duration)}</span></div>
        </div>
        ${d.skipped ? `<p class="qlp-blocked">${esc(T.blockedNote(d.skipped))}</p>` : ""}
        ${
          state.view === "all" && s.browsers && s.browsers.length > 1
            ? `<p class="qlp-meta qlp-matrix">${esc(
                (isMobileSection() ? T.matrixMobile : T.matrix)(s.checks, s.browsers.map((b) => BROWSER_NAMES[b] || b)),
              )}</p>`
            : ""
        }

        ${state.view === "all" ? renderChart(s) : ""}
        ${renderLegend(s)}
        <h3 class="qlp-results-title qlp-cases-title">${esc(T.casesTitle(listed.length))}</h3>
        ${renderPriorityFilter(d.tests)}
        <div class="qlp-tests">
          ${Object.entries(byFeature)
            .map(
              ([feature, tests]) => `
            <div class="qlp-group">
              <h4>${esc(feature)}${renderType(tests[0].type)}</h4>
              <ul>
                ${tests
                  .map((t) => {
                    let { st, ms } = renderStatus(t);
                    // Durante un'esecuzione: stato in diretta del controllo (sui browser coinvolti).
                    let liveRow = null;
                    if (info) {
                      const shown = state.view === "all" ? info.families : [state.view];
                      const states = shown.map((f) => liveStateOf(info, t, f)).filter(Boolean);
                      if (states.length) {
                        liveRow = states.includes("running") ? "running" : states.includes("pending") ? "pending" : null;
                        if (!liveRow) st = states.includes("failed") ? "failed" : states.includes("skipped") ? "skipped" : "passed";
                      }
                    }
                    const rowClass = liveRow ? `qlp-t-${liveRow}` : `qlp-t-${esc(st)}`;
                    const icon = liveRow === "running" ? '<span class="qlp-spin" aria-hidden="true"></span>' : liveRow === "pending" ? "○" : STATUS_ICON[st] || "?";
                    return `<li class="${rowClass}">
                      <span class="qlp-icon" aria-label="${esc(liveRow || st)}">${icon}</span>
                      <span class="qlp-name">${esc(titleOf(t))}${t.priority ? ` ${renderPriority(priorityOf(t))}` : ""}</span>
                      ${state.view === "all" ? renderBrowsers(t, info) : ""}
                      <span class="qlp-dur">${liveRow ? "—" : seconds(ms)}</span>
                    </li>`;
                  })
                  .join("")}
              </ul>
            </div>`,
            )
            .join("")}
        </div>`
      : `<p class="qlp-empty">${esc(T.noResults)}</p>`;

    root.innerHTML = `
      <div class="qlp-card ${state.justUpdated ? "qlp-updated" : ""}">
        ${renderSections()}
        ${renderTabs(s)}
        <div class="qlp-actions">
          ${renderButton()}
        </div>
        ${
          isMobileSection()
            ? `<p class="qlp-device-note">${esc(T.mobileNote)}</p>`
            : isMobileVisitor()
              ? `<p class="qlp-device-note">${esc(T.mobileVisitor)}</p>`
              : ""
        }
        ${renderLiveProgress()}
        ${state.message ? `<p class="qlp-message qlp-message-${state.messageKind}" role="status">${esc(state.message)}</p>` : ""}
        ${body}
      </div>`;

    const btn = root.querySelector(".qlp-run");
    if (btn) btn.addEventListener("click", startRun);
    const how = root.querySelector(".qlp-how-link");
    if (how) how.addEventListener("click", () => howDialog().showModal());
    root.querySelectorAll(".qlp-filter-btn").forEach((b) =>
      b.addEventListener("click", () => {
        state.priority = b.dataset.priority;
        render();
      }),
    );
    root.querySelectorAll(".qlp-section").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.section === state.section) return;
        setSection(b.dataset.section);
        state.view = "all";
        render();
      }),
    );
    root.querySelectorAll(".qlp-tab").forEach((tab) =>
      tab.addEventListener("click", () => {
        state.view = tab.dataset.view;
        render();
      }),
    );
  }

  function renderButton() {
    const st = state.status;
    let label = state.view === "all" ? T.runNow : T.runOn(BROWSER_NAMES[state.view]);
    let disabled = false;

    if (!st || !st.configured) {
      return ""; // senza token il pulsante non viene mostrato
    } else if (!RUN_KEY[state.view]) {
      label = T.autoOnly; // es. Galaxy Fold: solo nelle esecuzioni automatiche
      disabled = true;
    } else if (state.phase !== "idle" || (st.run && st.run.status !== "completed")) {
      label = T.running;
      disabled = true;
    } else if (st.cooldownRemaining > 0) {
      label = T.availableIn(Math.ceil(st.cooldownRemaining / 60));
      disabled = true;
    }
    return `<button type="button" class="qlp-run" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
  }



  /* ---------- Avvio e attesa dei test ---------- */

  async function startRun() {
    resetLive(Date.now() - 10000);
    state.phase = "starting";
    state.message = null;
    state.justUpdated = false;
    render();

    // Avvia i controlli sulla scheda selezionata ("all" = tutta la sezione: computer o dispositivi).
    const res = await getJson(cfg.runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser: RUN_KEY[state.view] }),
    });
    const body = res.body || {};

    if (res.status === 202) {
      return follow(new Date(body.startedAt).getTime() - 10000);
    }
    if (body.reason === "running") {
      // Il pulsante era ancora visibile, ma c'era già un'esecuzione: avvisiamo e la seguiamo.
      state.message = T.msgFollowing;
      state.messageKind = "warning";
      return follow(new Date(body.run.createdAt).getTime() - 1000);
    }

    state.phase = "idle";
    state.messageKind = "warning";
    state.message = body.reason === "cooldown" ? T.msgCooldown(Math.ceil(body.cooldownRemaining / 60)) : T.msgError;
    state.status = await loadStatus();
    render();
  }

  // Segue l'esecuzione creata dopo "since" finché non termina, poi ricarica i risultati.
  async function follow(since) {
    if (state.following) return; // la stiamo già seguendo
    state.following = true;
    if (state.phase !== "starting") resetLive(since); // dopo un clic è già stato azzerato in startRun
    live.since = since;
    const deadline = Date.now() + MAX_WAIT_MS;
    state.phase = "queued";
    render();

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      state.status = await loadStatus().catch(() => state.status);
      const run = state.status && state.status.run;
      if (!run || new Date(run.createdAt).getTime() < since) continue; // GitHub non la mostra ancora

      if (run.status === "completed") {
        state.phase = "refreshing";
        state.waiting = false;
        render();
        await refreshSummary(run);
        state.following = false;
        return;
      }
      state.phase = run.status === "in_progress" ? "in_progress" : "queued";
      // In coda dietro un'altra esecuzione (GitHub ne esegue una alla volta).
      state.waiting = state.phase === "queued" && (run.activeRuns || 1) > 1;
      render();
    }

    state.phase = "idle";
    state.following = false;
    state.waiting = false;
    state.messageKind = "warning";
    state.message = T.msgSlow;
    render();
  }

  // Il riepilogo su GitHub Pages può arrivare qualche secondo dopo la fine dell'esecuzione.
  async function refreshSummary(run) {
    const runId = String(run.id);
    for (let i = 0; i < 12; i++) {
      const s = await loadSummary().catch(() => null);
      if (s && s.runUrl && s.runUrl.endsWith("/" + runId)) {
        state.summary = s;
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    // Lasciamo vedere la barra arrivare al 100% prima di mostrare i risultati.
    live.target = 100;
    await new Promise((resolve) => {
      const giveUp = Date.now() + 4000;
      const wait = () => (live.shown >= 99.5 || Date.now() > giveUp ? setTimeout(resolve, 700) : requestAnimationFrame(wait));
      wait();
    });
    state.phase = "idle";
    state.justUpdated = true;
    state.messageKind = "info";
    state.message = run.conclusion === "success" ? T.msgDone : T.msgDoneKo;
    state.status = await loadStatus().catch(() => state.status);
    render();
  }

  /* ---------- Avvio ---------- */

  (async function init() {
    const [section, view] = detectDevice();
    setSection(section);
    state.view = view;
    const [summary, status] = await Promise.all([loadSummary().catch(() => null), loadStatus().catch(() => null)]);
    state.summary = summary;
    state.status = status;
    // Se non ci sono ancora risultati per i dispositivi emulati, si parte dalla sezione Computer.
    const grouped = groupByBrowser(summary);
    if (state.section === "mobile" && !(grouped && grouped.browsers && grouped.browsers.length)) {
      setSection("desktop");
      state.view = "all";
    }
    render();

    // Se un'esecuzione è già in corso quando la pagina si apre, la seguiamo.
    if (status && status.run && status.run.status !== "completed") {
      follow(new Date(status.run.createdAt).getTime() - 1000);
    }

    // Mentre la pagina è aperta controlliamo ogni 30 secondi (e quando si torna sulla scheda del browser):
    // se nel frattempo è partita un'esecuzione, il pulsante si blocca e la pagina la segue.
    async function checkForNewRun() {
      if (state.following || state.phase !== "idle" || document.visibilityState !== "visible") return;
      const st = await loadStatus().catch(() => null);
      if (!st) return;
      state.status = st;
      if (st.run && st.run.status !== "completed") {
        state.message = T.msgAutoFollow;
        state.messageKind = "info";
        follow(new Date(st.run.createdAt).getTime() - 1000);
      } else {
        render(); // aggiorna il pulsante (es. il conto alla rovescia "Disponibile tra N min")
      }
    }
    setInterval(checkForNewRun, 30000);
    document.addEventListener("visibilitychange", checkForNewRun);
  })();
})();
