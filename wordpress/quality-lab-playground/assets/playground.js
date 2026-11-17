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
      chartTitle: "Durata per browser",
      slowest: "il più lento",
      chartNote: "I browser vengono controllati contemporaneamente, ognuno su un computer separato: la verifica dura quanto il browser più lento.",
      howTitle: "Come funziona?",
      close: "Chiudi",
      how: [
        "A ogni verifica GitHub Actions avvia un computer separato per ogni browser, e partono tutti insieme.",
        "Su ogni computer i controlli vengono eseguiti uno dopo l'altro, sempre nello stesso ordine.",
        "Per questo il tempo di verifica è quello del browser più lento, non la somma dei tempi.",
        "La lunghezza della barra indica solo il tempo; accanto a ogni browser trovi quanti controlli ha superato.",
      ],
      matrix: (checks, n, names) => `${checks} controlli, ripetuti su ${n} browser: ${names}`,
      engines: { chromium: "motore Chromium (Chrome)", msedge: "Microsoft Edge (motore Chromium)", firefox: "motore Gecko (Firefox)", webkit: "motore WebKit (Safari)" },
      allBrowsers: "Tutti i browser",
      tabsLabel: "Scegli il browser",
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
      chartTitle: "Duration per browser",
      slowest: "the slowest",
      chartNote: "The browsers are checked at the same time, each on a separate computer: the run lasts as long as the slowest browser.",
      howTitle: "How does it work?",
      close: "Close",
      how: [
        "For every run, GitHub Actions starts a separate computer for each browser, and they all start together.",
        "On each computer the checks run one after another, always in the same order.",
        "That's why the check time is the one of the slowest browser, not the sum of the times.",
        "A bar's length shows only the time; next to each browser you'll find how many checks it passed.",
      ],
      matrix: (checks, n, names) => `${checks} checks, repeated on ${n} browsers: ${names}`,
      engines: { chromium: "Chromium engine (Chrome)", msedge: "Microsoft Edge (Chromium engine)", firefox: "Gecko engine (Firefox)", webkit: "WebKit engine (Safari)" },
      allBrowsers: "All browsers",
      tabsLabel: "Choose the browser",
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
    view: "all", // scheda selezionata: "all" oppure un browser (chromium, msedge, firefox, webkit)
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
      <h4>${esc(T.chartTitle)}</h4>
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
      <p class="qlp-chart-note">${esc(T.chartNote)}</p>
      <button type="button" class="qlp-how-link" aria-haspopup="dialog">${esc(T.howTitle)}</button>
    </div>`;
  }

  // "skipped" = bloccato dalla protezione anti-bot: non verificabile, ma non è un errore del sito.
  const isOk = (status) => status === "passed" || status === "skipped";

  const STATUS_ICON = { passed: "✓", failed: "✗", broken: "!", skipped: "–" };

  // Nomi familiari per il pubblico; il tooltip indica il motore di rendering reale.
  const BROWSER_NAMES = { chromium: "Chrome", msedge: "Edge", firefox: "Firefox", webkit: "Safari" };
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
  function renderLegend(s) {
    const items = [];
    if (s.tests.some((t) => TYPE_NAMES[t.type])) {
      items.push([renderType("smoke"), T.types.smoke[1]], [renderType("regression"), T.types.regression[1]]);
    }
    if (s.tests.some((t) => t.priority)) {
      items.push([renderPriority("blocker"), T.priorities.blocker[1]], [renderPriority("major"), T.priorities.major[1]]);
    }
    if (!items.length) return "";
    return `<ul class="qlp-legend">${items.map(([chip, text]) => `<li>${chip}<span>${esc(text)}</span></li>`).join("")}</ul>`;
  }


  function renderBrowsers(t, info) {
    if (!t.browsers) return "";
    return `<span class="qlp-browsers">${Object.keys(BROWSER_NAMES)
      .filter((b) => b in t.browsers || (info && info.browsers.includes(b)))
      .map((b) => {
        // Durante un'esecuzione mostriamo lo stato in diretta, altrimenti l'ultimo risultato.
        const st = liveStateOf(info, t, b) || t.browsers[b];
        const word = { passed: T.passed, skipped: T.notVerifiable, pending: T.live.pending, running: T.live.running }[st] || T.notPassed;
        const hint = `${T.engines[b]}: ${word}`;
        return `<span class="qlp-b qlp-b-${esc(st)}" title="${esc(hint)}">${BROWSER_NAMES[b]}</span>`;
      })
      .join("")}</span>`;
  }

  // Finestra modale "Come funziona?": creata una sola volta e aggiunta a <body>,
  // così non si chiude quando il riquadro viene ridisegnato durante un'esecuzione.
  let dialog = null;
  function howDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "qlp qlp-modal";
    dialog.setAttribute("aria-labelledby", "qlp-how-title");
    dialog.setAttribute("data-no-translation", ""); // le traduzioni le gestiamo noi, non TranslatePress
    dialog.innerHTML = `
      <h3 id="qlp-how-title">${esc(T.howTitle)}</h3>
      <ul>${T.how.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
      <form method="dialog"><button type="submit" class="qlp-run">${esc(T.close)}</button></form>`;
    // Un clic sullo sfondo scuro (fuori dal contenuto) chiude la finestra; Esc la chiude già da solo.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  /* ---------- Avanzamento in diretta ---------- */
  // Durante un'esecuzione i test comunicano a WordPress "iniziato / superato / fallito" (status.progress).
  // Da qui ricaviamo lo stato di ogni controllo e una barra che si riempie in modo continuo,
  // agganciata ai dati reali: non supera mai il punto successivo e non torna mai indietro.

  const ALL_TEST_BROWSERS = ["chromium", "msedge", "firefox", "webkit"];
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

  // Browser coinvolti nell'esecuzione: dal titolo (es. "E2E · website · firefox"), altrimenti tutti.
  function runBrowsers(run) {
    const m = run && run.title && run.title.match(/·\s*(chromium|msedge|firefox|webkit)\s*$/);
    return m ? [m[1]] : ALL_TEST_BROWSERS;
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
    return { browsers, progress, done, partial, total, current, hasData: Object.keys(progress).length > 0 };
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
    return T.live.tests(info.done, info.total);
  }

  function renderLiveProgress() {
    if (state.phase === "idle") return "";
    const info = liveInfo();
    const pct = Math.round(live.shown);
    const now = info && info.current.length
      ? `<p class="qlp-live-now"><span class="qlp-pulse"></span>${esc(T.live.runningNow)}: ${info.current
          .slice(0, 2)
          .map((c) => `«${esc(titleOf(c.t))}» ${esc(T.live.on)} ${BROWSER_NAMES[c.b]}`)
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

  // Stato in diretta di un controllo su un browser: pending, running, passed, failed, skipped (o null se non in corso).
  function liveStateOf(info, t, b) {
    if (!info || !info.browsers.includes(b) || !t.key) return null;
    const s = info.progress[b] && info.progress[b].tests[t.key];
    return s || "pending";
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

  function renderTabs(s) {
    const known = Object.keys(BROWSER_NAMES);
    const tabs = [["all", T.allBrowsers], ...known.map((b) => [b, BROWSER_NAMES[b]])];
    return `<div class="qlp-tabs" role="tablist" aria-label="${esc(T.tabsLabel)}">${tabs
      .map(([key, name]) => {
        const selected = state.view === key;
        // Pallino colorato con l'esito di quel browser (nessuno se non ha ancora risultati).
        let dot = "";
        if (key !== "all" && s.tests.some((t) => t.browsers && key in t.browsers)) {
          const ok = s.tests.every((t) => !t.browsers || !(key in t.browsers) || isOk(t.browsers[key]));
          dot = `<span class="qlp-tab-dot ${ok ? "qlp-ok" : "qlp-ko"}"></span>`;
        }
        return `<button type="button" role="tab" class="qlp-tab" data-view="${esc(key)}" aria-selected="${selected}">${dot}${esc(name)}</button>`;
      })
      .join("")}</div>`;
  }

  function renderStatus(t) {
    // Nella scheda di un singolo browser mostriamo lo stato di quel browser, altrimenti il peggiore.
    const st = state.view === "all" ? t.status : t.browsers[state.view];
    const ms = state.view === "all" ? t.durationMs : (t.durations && t.durations[state.view]) ?? t.durationMs;
    return { st, ms };
  }

  function render() {
    const s = state.summary;
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
        <div class="qlp-head">
          <span class="qlp-pill ${ok ? "qlp-ok" : "qlp-ko"}">
            <span class="qlp-dot"></span>${esc(ok ? T.siteOk : T.siteKo)}
          </span>
          <span class="qlp-meta">${esc(T.lastRun(timeAgo(d.startedAt), T.triggers[d.trigger] || d.trigger))}</span>
        </div>

        <div class="qlp-stats">
          <div class="qlp-stat"><span class="qlp-num">${d.passed}/${d.total}</span><span class="qlp-label">${esc(T.checksPassed)}</span></div>
          <div class="qlp-stat"><span class="qlp-num">${d.successRate.toLocaleString(LANG)}%</span><span class="qlp-label">${esc(T.successRate)}</span></div>
          <div class="qlp-stat"><span class="qlp-num">${minutes(d.durationMs)}</span><span class="qlp-label">${esc(state.view === "all" ? T.durationAll : T.duration)}</span></div>
        </div>
        ${d.skipped ? `<p class="qlp-blocked">${esc(T.blockedNote(d.skipped))}</p>` : ""}
        ${
          state.view === "all" && s.browsers && s.browsers.length > 1
            ? `<p class="qlp-meta qlp-matrix">${esc(
                T.matrix(s.checks, s.browsers.length, s.browsers.map((b) => BROWSER_NAMES[b] || b).join(", ")),
              )}</p>`
            : ""
        }

        ${state.view === "all" ? renderChart(s) : ""}
        ${renderLegend(s)}
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
                      const states = (state.view === "all" ? info.browsers : [state.view]).map((b) => liveStateOf(info, t, b)).filter(Boolean);
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
        ${renderTabs(s)}
        <div class="qlp-actions">
          ${renderButton()}
        </div>
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

    // Avvia i controlli sul browser della scheda selezionata ("all" = tutti).
    const res = await getJson(cfg.runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser: state.view }),
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
    const [summary, status] = await Promise.all([loadSummary().catch(() => null), loadStatus().catch(() => null)]);
    state.summary = summary;
    state.status = status;
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
