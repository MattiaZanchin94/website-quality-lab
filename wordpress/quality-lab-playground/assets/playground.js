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
      matrix: (checks, n, names) => `${checks} controlli, ripetuti su ${n} browser: ${names}`,
      engines: { chromium: "motore Chromium (Chrome)", msedge: "Microsoft Edge (motore Chromium)", firefox: "motore Gecko (Firefox)", webkit: "motore WebKit (Safari)" },
      allBrowsers: "Tutti i browser",
      tabsLabel: "Scegli il browser",
      noResults: "Nessun risultato ancora per questo browser: avvia i controlli per ottenerli.",
      runOn: (name) => `▶ Avvia i controlli su ${name}`,
      passed: "superato",
      notPassed: "non superato",
      types: {
        smoke: ["Controllo essenziale: verifica che le funzioni principali del sito siano disponibili", "controlli essenziali, i primi a segnalare un problema"],
        regression: ["Controllo approfondito: verifica che le funzionalità esistenti continuino a funzionare", "controlli approfonditi sulle singole funzionalità"],
      },
      other: "Altro",
      runNow: "▶ Avvia i controlli ora",
      running: "Controlli in corso…",
      availableIn: (min) => `Disponibile tra ${min} min`,
      steps: {
        starting: "Richiesta inviata",
        queued: "Preparazione dell'ambiente di verifica",
        in_progress: "Verifica del sito in corso (circa 2–3 minuti)",
        refreshing: "Pubblicazione dei risultati",
      },
      msgFollowing: "Qualcuno ha appena avviato i controlli: seguiamo quella verifica.",
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
      matrix: (checks, n, names) => `${checks} checks, repeated on ${n} browsers: ${names}`,
      engines: { chromium: "Chromium engine (Chrome)", msedge: "Microsoft Edge (Chromium engine)", firefox: "Gecko engine (Firefox)", webkit: "WebKit engine (Safari)" },
      allBrowsers: "All browsers",
      tabsLabel: "Choose the browser",
      noResults: "No results yet for this browser: run the checks to get them.",
      runOn: (name) => `▶ Run the checks on ${name}`,
      passed: "passed",
      notPassed: "not passed",
      types: {
        smoke: ["Essential check: verifies that the site's main functions are available", "essential checks, the first to flag a problem"],
        regression: ["In-depth check: verifies that existing features keep working", "in-depth checks on individual features"],
      },
      other: "Other",
      runNow: "▶ Run the checks now",
      running: "Checks in progress…",
      availableIn: (min) => `Available in ${min} min`,
      steps: {
        starting: "Request sent",
        queued: "Preparing the test environment",
        in_progress: "Checking the site (about 2–3 minutes)",
        refreshing: "Publishing the results",
      },
      msgFollowing: "Someone has just started the checks: we're following that run.",
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
    message: null,
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

  const STATUS_ICON = { passed: "✓", failed: "✗", broken: "!", skipped: "–" };

  // Nomi familiari per il pubblico; il tooltip indica il motore di rendering reale.
  const BROWSER_NAMES = { chromium: "Chrome", msedge: "Edge", firefox: "Firefox", webkit: "Safari" };
  const TYPE_NAMES = { smoke: "Smoke", regression: "Regression" };

  function renderType(type) {
    if (!TYPE_NAMES[type]) return "";
    return ` <span class="qlp-type qlp-type-${esc(type)}" title="${esc(T.types[type][0])}">${TYPE_NAMES[type]}</span>`;
  }

  function renderLegend(s) {
    if (!s.tests.some((t) => TYPE_NAMES[t.type])) return "";
    return `<p class="qlp-legend">
      ${renderType("smoke")} ${esc(T.types.smoke[1])}
      <span class="qlp-sep">·</span>
      ${renderType("regression")} ${esc(T.types.regression[1])}
    </p>`;
  }

  function renderBrowsers(t) {
    if (!t.browsers) return "";
    return `<span class="qlp-browsers">${Object.keys(BROWSER_NAMES)
      .filter((b) => b in t.browsers)
      .map((b) => {
        const st = t.browsers[b];
        const hint = `${T.engines[b]}: ${st === "passed" ? T.passed : T.notPassed}`;
        return `<span class="qlp-b qlp-b-${esc(st)}" title="${esc(hint)}">${BROWSER_NAMES[b]}</span>`;
      })
      .join("")}</span>`;
  }

  /* ---------- Render ---------- */

  // Vista dei dati per la scheda selezionata: tutti i browser oppure uno solo.
  function viewData(s) {
    const v = state.view;
    if (v === "all") {
      return {
        tests: s.tests,
        passed: s.passed,
        total: s.total,
        successRate: s.successRate,
        durationMs: s.durationMs,
        startedAt: s.startedAt,
        trigger: s.trigger,
        status: s.status,
      };
    }
    const tests = s.tests.filter((t) => t.browsers && v in t.browsers);
    const passed = tests.filter((t) => t.browsers[v] === "passed").length;
    const run = (s.runs && s.runs[v]) || {};
    return {
      tests,
      passed,
      total: tests.length,
      successRate: tests.length ? Math.round((passed / tests.length) * 1000) / 10 : 0,
      durationMs: run.durationMs ?? 0,
      startedAt: run.startedAt ?? s.startedAt,
      trigger: run.trigger ?? s.trigger,
      status: tests.length && passed === tests.length ? "passed" : "failed",
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
          const ok = s.tests.every((t) => !t.browsers || !(key in t.browsers) || t.browsers[key] === "passed");
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
    const ok = d.status === "passed";
    const byFeature = {};
    for (const t of d.tests) (byFeature[featureOf(t)] ||= []).push(t);

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
          <div class="qlp-stat"><span class="qlp-num">${seconds(d.durationMs)}</span><span class="qlp-label">${esc(T.duration)}</span></div>
        </div>
        ${
          state.view === "all" && s.browsers && s.browsers.length > 1
            ? `<p class="qlp-meta qlp-matrix">${esc(
                T.matrix(s.checks, s.browsers.length, s.browsers.map((b) => BROWSER_NAMES[b] || b).join(", ")),
              )}</p>`
            : ""
        }

        ${renderLegend(s)}
        <div class="qlp-tests">
          ${Object.entries(byFeature)
            .map(
              ([feature, tests]) => `
            <div class="qlp-group">
              <h4>${esc(feature)}${renderType(tests[0].type)}</h4>
              <ul>
                ${tests
                  .map((t) => {
                    const { st, ms } = renderStatus(t);
                    return `<li class="qlp-t-${esc(st)}">
                      <span class="qlp-icon" aria-label="${esc(st)}">${STATUS_ICON[st] || "?"}</span>
                      <span class="qlp-name">${esc(titleOf(t))}</span>
                      ${state.view === "all" ? renderBrowsers(t) : ""}
                      <span class="qlp-dur">${seconds(ms)}</span>
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
        ${body}
        <div class="qlp-actions">
          ${renderButton()}
        </div>
        ${renderProgress()}
        ${state.message ? `<p class="qlp-message">${esc(state.message)}</p>` : ""}
      </div>`;

    const btn = root.querySelector(".qlp-run");
    if (btn) btn.addEventListener("click", startRun);
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

  function renderProgress() {
    if (state.phase === "idle") return "";
    const keys = ["starting", "queued", "in_progress", "refreshing"];
    const current = keys.indexOf(state.phase);
    return `<ol class="qlp-progress">${keys
      .map((key, i) => `<li class="${i < current ? "qlp-done" : i === current ? "qlp-now" : ""}">${esc(T.steps[key])}</li>`)
      .join("")}</ol>`;
  }

  /* ---------- Avvio e attesa dei test ---------- */

  async function startRun() {
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
      state.message = T.msgFollowing;
      return follow(new Date(body.run.createdAt).getTime() - 1000);
    }

    state.phase = "idle";
    state.message = body.reason === "cooldown" ? T.msgCooldown(Math.ceil(body.cooldownRemaining / 60)) : T.msgError;
    state.status = await loadStatus();
    render();
  }

  // Segue l'esecuzione creata dopo "since" finché non termina, poi ricarica i risultati.
  async function follow(since) {
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
        render();
        await refreshSummary(run);
        return;
      }
      state.phase = run.status === "in_progress" ? "in_progress" : "queued";
      render();
    }

    state.phase = "idle";
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
    state.phase = "idle";
    state.justUpdated = true;
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
  })();
})();
