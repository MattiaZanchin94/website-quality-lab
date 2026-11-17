/* Quality Lab Playground – disegna i risultati e gestisce il pulsante "Esegui i test ora". */
(function () {
  "use strict";

  const cfg = window.QLP_CONFIG;
  const root = document.getElementById("qlp-root");
  if (!cfg || !root) return;

  const POLL_MS = 5000;
  const MAX_WAIT_MS = 8 * 60 * 1000;

  const state = {
    summary: null,
    status: null,
    phase: "idle", // idle | starting | queued | in_progress | refreshing
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

  /* ---------- Formattazione ---------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  function timeAgo(iso) {
    const sec = Math.round((new Date(iso) - Date.now()) / 1000);
    const abs = Math.abs(sec);
    if (abs < 60) return rtf.format(sec, "second");
    if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
    return rtf.format(Math.round(sec / 86400), "day");
  }

  const TRIGGERS = {
    schedule: "esecuzione automatica oraria",
    push: "aggiornamento del codice",
    website: "un visitatore del sito",
    manual: "avvio manuale",
    local: "esecuzione locale",
  };

  const STATUS_ICON = { passed: "✓", failed: "✗", broken: "!", skipped: "–" };

  /* ---------- Render ---------- */

  function render() {
    const s = state.summary;
    if (!s) {
      root.innerHTML = '<p class="qlp-error">Al momento non è possibile caricare i risultati. Riprova tra poco.</p>';
      return;
    }

    const ok = s.status === "passed";
    const byFeature = {};
    for (const t of s.tests) (byFeature[t.feature || "Altro"] ||= []).push(t);

    root.innerHTML = `
      <div class="qlp-card ${state.justUpdated ? "qlp-updated" : ""}">
        <div class="qlp-head">
          <span class="qlp-pill ${ok ? "qlp-ok" : "qlp-ko"}">
            <span class="qlp-dot"></span>${ok ? "Sito operativo" : "Problemi rilevati"}
          </span>
          <span class="qlp-meta">
            Ultima esecuzione ${esc(timeAgo(s.startedAt))}, avviata da ${esc(TRIGGERS[s.trigger] || s.trigger)}
          </span>
        </div>

        <div class="qlp-stats">
          <div class="qlp-stat"><span class="qlp-num">${s.passed}/${s.total}</span><span class="qlp-label">controlli superati</span></div>
          <div class="qlp-stat"><span class="qlp-num">${s.successRate}%</span><span class="qlp-label">tasso di successo</span></div>
          <div class="qlp-stat"><span class="qlp-num">${(s.durationMs / 1000).toFixed(1)} s</span><span class="qlp-label">tempo di verifica</span></div>
        </div>

        <div class="qlp-tests">
          ${Object.entries(byFeature)
            .map(
              ([feature, tests]) => `
            <div class="qlp-group">
              <h4>${esc(feature)}</h4>
              <ul>
                ${tests
                  .map(
                    (t) => `<li class="qlp-t-${esc(t.status)}">
                      <span class="qlp-icon" aria-label="${esc(t.status)}">${STATUS_ICON[t.status] || "?"}</span>
                      <span class="qlp-name">${esc(t.title)}</span>
                      <span class="qlp-dur">${(t.durationMs / 1000).toFixed(1)} s</span>
                    </li>`,
                  )
                  .join("")}
              </ul>
            </div>`,
            )
            .join("")}
        </div>

        <div class="qlp-actions">
          ${renderButton()}
        </div>
        ${renderProgress()}
        ${state.message ? `<p class="qlp-message">${esc(state.message)}</p>` : ""}
      </div>`;

    const btn = root.querySelector(".qlp-run");
    if (btn) btn.addEventListener("click", startRun);
  }

  function renderButton() {
    const st = state.status;
    let label = "▶ Avvia i controlli ora";
    let disabled = false;

    if (!st || !st.configured) {
      return ""; // senza token il pulsante non viene mostrato
    } else if (state.phase !== "idle" || (st.run && st.run.status !== "completed")) {
      label = "Controlli in corso…";
      disabled = true;
    } else if (st.cooldownRemaining > 0) {
      label = `Disponibile tra ${Math.ceil(st.cooldownRemaining / 60)} min`;
      disabled = true;
    }
    return `<button type="button" class="qlp-run" ${disabled ? "disabled" : ""}>${label}</button>`;
  }

  function renderProgress() {
    if (state.phase === "idle") return "";
    const steps = [
      ["starting", "Richiesta inviata"],
      ["queued", "Preparazione dell'ambiente di verifica"],
      ["in_progress", "Verifica del sito in corso (circa 2–3 minuti)"],
      ["refreshing", "Pubblicazione dei risultati"],
    ];
    const current = steps.findIndex(([key]) => key === state.phase);
    return `<ol class="qlp-progress">${steps
      .map(([, text], i) => `<li class="${i < current ? "qlp-done" : i === current ? "qlp-now" : ""}">${text}</li>`)
      .join("")}</ol>`;
  }

  /* ---------- Avvio e attesa dei test ---------- */

  async function startRun() {
    state.phase = "starting";
    state.message = null;
    state.justUpdated = false;
    render();

    const res = await getJson(cfg.runUrl, { method: "POST" });
    const body = res.body || {};

    if (res.status === 202) {
      return follow(new Date(body.startedAt).getTime() - 10000);
    }
    if (body.reason === "running") {
      state.message = "Qualcuno ha appena avviato i controlli: seguiamo quella verifica.";
      return follow(new Date(body.run.createdAt).getTime() - 1000);
    }

    state.phase = "idle";
    state.message =
      body.reason === "cooldown"
        ? `I controlli sono stati eseguiti da poco. Potrai riavviarli tra ${Math.ceil(body.cooldownRemaining / 60)} minuti.`
        : "Non è stato possibile avviare i controlli. Riprova più tardi.";
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
    state.message = "La verifica sta richiedendo più del previsto. Riprova a ricaricare la pagina tra qualche minuto.";
    render();
  }

  // Il report su GitHub Pages può arrivare qualche secondo dopo la fine dell'esecuzione.
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
    state.message =
      run.conclusion === "success" ? "Fatto! Ecco i risultati appena ottenuti." : "Verifica terminata: alcuni controlli non sono andati a buon fine.";
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
