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
      // Tutti i controlli della vista bloccati dal CAPTCHA dell'hosting: nessun esito, né buono né cattivo.
      siteUnverified: "Non verificabile al momento",
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
      totalDuration: "durata totale su GitHub",
      testsPart: (time, parallel) => `di cui test: ${time}${parallel ? ` (${parallel})` : ""}`,
      parallelBrowsers: "browser in parallelo",
      parallelDevices: "dispositivi in parallelo",
      overhead: (time) => `Al tempo dei test si aggiungono ${time} per preparare le macchine e pubblicare i risultati: è la durata totale indicata sopra.`,
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
        "Per questo il tempo dei test è quello del browser più lento, non la somma dei tempi.",
        "La durata totale comprende anche la preparazione delle macchine (avvio, compilazione del progetto, installazione di Edge) e la pubblicazione dei risultati sul sito.",
        "Come al campetto si gioca a turno: una partita alla volta e, tra un avvio e l'altro dei visitatori, 10 minuti per pulire il parquet. È una pausa uguale per tutti, perché il sito non si affatichi.",
        "La lunghezza della barra indica solo il tempo; accanto a ogni browser trovi quanti controlli ha superato.",
        "I controlli riguardano la versione del sito per computer: Chrome, Edge, Firefox e Safari.",
      ],
      howMobile: [
        "A ogni verifica GitHub Actions avvia un computer separato per ogni dispositivo, e partono tutti insieme.",
        "I dispositivi sono emulati: lo stesso motore del browser (Safari per iPhone e iPad, Chrome per Android) con schermo, touch e identità di un iPhone 15, di un Pixel 7, di un iPad Pro 11 e di un Galaxy Z Fold 7 chiuso. Non sono dispositivi veri.",
        "Su ogni computer i controlli vengono eseguiti uno dopo l'altro, come farebbe una persona: sul telefono aprono anche il menu mobile del sito.",
        "Per questo il tempo dei test è quello del dispositivo più lento, non la somma dei tempi.",
        "La durata totale comprende anche la preparazione delle macchine (avvio e compilazione del progetto) e la pubblicazione dei risultati sul sito.",
        "Come al campetto si gioca a turno: una partita alla volta e, tra un avvio e l'altro dei visitatori, 10 minuti per pulire il parquet. È una pausa uguale per tutti, perché il sito non si affatichi.",
        "L'iPad viene provato sia in verticale sia in orizzontale; il Galaxy Fold solo nelle esecuzioni automatiche.",
      ],
      // Primo livello: cosa si verifica. Secondo livello (solo Funzionalità): dove.
      areas: { functional: "🧭 Funzionalità", security: "🔒 Sicurezza", marketing: "📣 Marketing", seo: "🔎 SEO" },
      areasLabel: "Scegli cosa verificare",
      // Finestra ⓘ accanto ai controlli che hanno una spiegazione.
      explainButton: (name) => `Cosa significa il controllo «${name}»?`,
      explainWhat: "Cosa verifica",
      explainWhy: "Perché è importante",
      sections: { desktop: "💻 Computer", mobile: "📱 Smartphone e tablet" },
      securityNote:
        "Questi controlli verificano che il sito sia protetto come si deve: connessione sicura, certificato valido e impostazioni di protezione. " +
        "Sono uguali per tutti i browser, quindi vengono verificati una volta, con Chrome.",
      durationSecurity: "tempo dei controlli di sicurezza",
      ownerOnlyTitle: "🔒 Perché solo il proprietario può avviarli",
      ownerOnly:
        "Per tutelare il sito, i controlli di sicurezza li avvio solo io, di tanto in tanto. " +
        "Qui sotto trovi i risultati dell'ultima verifica, con la data.",
      durationSeo: "tempo dei controlli SEO",
      durationMarketing: "tempo dei controlli di marketing",
      seoNote:
        "I segnali di base che Google e i social leggono su ogni pagina chiave: titolo, descrizione, lingua, " +
        "indirizzo canonico e anteprima per la condivisione. Sono uguali per tutti i browser, quindi vengono verificati una volta, con Chrome.",
      marketingNote:
        "Misurazione delle visite (Google Analytics 4 con il consenso), campagne con parametri UTM, contatti, brand nei titoli, " +
        "pagina 404, anteprime social e velocità da smartphone. Gli invii ad Analytics dei test vengono sempre bloccati, " +
        "quindi le statistiche restano pulite. Si verificano una volta, con Chrome.",
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
      manualOnly: "🔒 Avvio riservato al proprietario",
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
      // Il Playground è un campetto: una partita alla volta, poi una pausa per pulire il parquet.
      running: "🏀 Partita in corso…",
      availableIn: (min) => `🧹 Pulizia del parquet: libero tra ${min} min`,
      courtBusy: "🏀 Il campetto è occupato: c'è una partita in corso. Quando finisce, puoi scendere in campo anche tu; intanto puoi seguirla qui sotto.",
      courtCleaning: (min) =>
        `🧹 Stanno pulendo il parquet: il campetto torna libero tra ${min === 1 ? "1 minuto" : `${min} minuti`}. Intanto puoi guardare i risultati dell'ultima partita.`,
      // Spiegazioni nel tooltip del pulsante: perché si aspetta, con le regole del campetto.
      whyLink: "Perché devo aspettare?",
      whyBusy: (min) =>
        `Come al campetto, si gioca una partita alla volta: chi arriva aspetta il suo turno a bordo campo. La partita dura circa ${min === 1 ? "1 minuto" : `${min} minuti`}.`,
      whyCleaning: (min) =>
        `Una partita ogni ${min} minuti, uguale per tutti i visitatori: tra una partita e l'altra si pulisce il parquet, così il sito non si affatica e il campetto resta aperto a tutti.`,
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
      // Ogni controllo che finisce durante una partita è un tiro: canestro se passa, ferro se no.
      shot: {
        made: (title, where) => `🏀 Canestro! «${title}» su ${where}`,
        missed: (title, where) => `🔔 Ferro! «${title}» su ${where} non è passato`,
        score: (made, missed) => `Canestri ${made} · Ferri ${missed}`,
        // Didascalia tra un tiro e l'altro: segue le fasi dell'esecuzione su GitHub.
        phase: {
          starting: "📨 Richiesta inviata: il giocatore entra in campo",
          waiting: "⏳ In coda: aspetta a bordo campo la fine della partita precedente",
          setup: "🔧 Riscaldamento: GitHub prepara i browser",
          playing: (title, where) => `▶ In campo: «${title}» su ${where}`,
          publish: "🏁 Fine partita: pubblicazione dei risultati",
        },
      },
      steps: {
        starting: "Richiesta inviata",
        queued: "Preparazione dell'ambiente di verifica",
        in_progress: "Verifica del sito in corso (circa 2–3 minuti)",
        refreshing: "Pubblicazione dei risultati",
      },
      msgFollowing: "Qualcuno ti ha preceduto: il campetto è occupato da una partita in corso. Quando finisce, puoi scendere in campo anche tu; intanto puoi seguirla qui sotto.",
      waiting: "In coda: c'è un'altra verifica in corso, questa partirà subito dopo",
      msgCooldown: (min) => `🧹 Stanno pulendo il parquet: il campetto torna libero tra ${min === 1 ? "1 minuto" : `${min} minuti`}.`,
      msgError: "Non è stato possibile avviare i controlli. Riprova più tardi.",
      msgSlow: "La verifica sta richiedendo più del previsto. Riprova a ricaricare la pagina tra qualche minuto.",
      msgDone: "Fatto! Ecco i risultati appena ottenuti.",
      msgDoneKo: "Verifica terminata: alcuni controlli non sono andati a buon fine.",
    },
    en: {
      loadError: "Results can't be loaded right now. Please try again shortly.",
      siteOk: "Site operational",
      siteKo: "Issues detected",
      siteUnverified: "Can't be verified right now",
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
      totalDuration: "total time on GitHub",
      testsPart: (time, parallel) => `tests: ${time}${parallel ? ` (${parallel})` : ""}`,
      parallelBrowsers: "browsers in parallel",
      parallelDevices: "devices in parallel",
      overhead: (time) => `On top of the tests, ${time} go into preparing the machines and publishing the results: that's the total time shown above.`,
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
        "That's why the test time is the one of the slowest browser, not the sum of the times.",
        "The total time also includes preparing the machines (start-up, building the project, installing Edge) and publishing the results on the site.",
        "Like at the playground, everyone takes turns: one game at a time and, between visitors' runs, 10 minutes to mop the court. The pause is the same for everyone, so the site doesn't get tired.",
        "A bar's length shows only the time; next to each browser you'll find how many checks it passed.",
        "The checks cover the desktop version of the site: Chrome, Edge, Firefox and Safari.",
      ],
      howMobile: [
        "For every run, GitHub Actions starts a separate computer for each device, and they all start together.",
        "The devices are emulated: the same browser engine (Safari for iPhone and iPad, Chrome for Android) with the screen, touch and identity of an iPhone 15, a Pixel 7, an iPad Pro 11 and a folded Galaxy Z Fold 7. They are not real devices.",
        "On each computer the checks run one after another, like a person would: on phones they also open the site's mobile menu.",
        "That's why the test time is the one of the slowest device, not the sum of the times.",
        "The total time also includes preparing the machines (start-up and building the project) and publishing the results on the site.",
        "Like at the playground, everyone takes turns: one game at a time and, between visitors' runs, 10 minutes to mop the court. The pause is the same for everyone, so the site doesn't get tired.",
        "The iPad is tested both in portrait and in landscape; the Galaxy Fold only in the automatic runs.",
      ],
      areas: { functional: "🧭 Functionality", security: "🔒 Security", marketing: "📣 Marketing", seo: "🔎 SEO" },
      areasLabel: "Choose what to check",
      explainButton: (name) => `What does the check “${name}” mean?`,
      explainWhat: "What it checks",
      explainWhy: "Why it matters",
      sections: { desktop: "💻 Desktop", mobile: "📱 Phones and tablets" },
      securityNote:
        "These checks verify that the site is properly protected: secure connection, valid certificate and protection settings. " +
        "They're the same for every browser, so they're checked once, with Chrome.",
      durationSecurity: "time of the security checks",
      ownerOnlyTitle: "🔒 Why only the owner can start them",
      ownerOnly:
        "To protect the site, I start the security checks myself, now and then. " +
        "Below you'll find the results of the latest check, with its date.",
      durationSeo: "time of the SEO checks",
      durationMarketing: "time of the marketing checks",
      seoNote:
        "The basic signals Google and social networks read on every key page: title, description, language, " +
        "canonical address and sharing preview. They're the same for every browser, so they're checked once, with Chrome.",
      marketingNote:
        "Visit measurement (Google Analytics 4 with consent), UTM campaign parameters, contacts, brand in titles, " +
        "404 page, social previews and speed on phones. The tests' Analytics hits are always blocked, " +
        "so the statistics stay clean. Checked once, with Chrome.",
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
      manualOnly: "🔒 Started by the owner only",
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
      running: "🏀 Game in progress…",
      availableIn: (min) => `🧹 Mopping the court: free in ${min} min`,
      courtBusy: "🏀 The court is busy: a game is on. When it ends, you can play too; meanwhile, you can follow it below.",
      courtCleaning: (min) =>
        `🧹 They're mopping the court: it's free again in ${min === 1 ? "1 minute" : `${min} minutes`}. Meanwhile, have a look at the results of the last game.`,
      whyLink: "Why do I have to wait?",
      whyBusy: (min) =>
        `Like at the playground, one game at a time: whoever arrives waits for their turn courtside. A game lasts about ${min === 1 ? "1 minute" : `${min} minutes`}.`,
      whyCleaning: (min) =>
        `One game every ${min} minutes, the same for every visitor: between games the court gets mopped, so the site doesn't get tired and the court stays open to everyone.`,
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
      shot: {
        made: (title, where) => `🏀 Swish! “${title}” on ${where}`,
        missed: (title, where) => `🔔 Off the rim! “${title}” on ${where} didn't pass`,
        score: (made, missed) => `Baskets ${made} · Rims ${missed}`,
        phase: {
          starting: "📨 Request sent: the player walks onto the court",
          waiting: "⏳ Queued: waiting courtside for the previous game to end",
          setup: "🔧 Warming up: GitHub is preparing the browsers",
          playing: (title, where) => `▶ On court: “${title}” on ${where}`,
          publish: "🏁 Game over: publishing the results",
        },
      },
      steps: {
        starting: "Request sent",
        queued: "Preparing the test environment",
        in_progress: "Checking the site (about 2–3 minutes)",
        refreshing: "Publishing the results",
      },
      msgFollowing: "Someone beat you to it: the court is busy with a game. When it ends, you can play too; meanwhile, you can follow it below.",
      waiting: "Queued: another run is in progress, this one will start right after",
      msgCooldown: (min) => `🧹 They're mopping the court: it's free again in ${min === 1 ? "1 minute" : `${min} minutes`}.`,
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
    section: "desktop", // "desktop" (browser per computer), "mobile" (dispositivi emulati) o "security"
    lastFunctionalSection: "desktop", // sezione a cui tornare passando da Sicurezza a Funzionalità
    view: "all", // scheda selezionata: "all" oppure un browser o dispositivo della sezione
    priority: "all", // filtro dei controlli: "all", "blocker" oppure "major"
  };

  // Due campetti indipendenti: Funzionalità (computer e dispositivi) e Sicurezza.
  // Ognuno ha la sua partita, la sua barra di avanzamento, i suoi messaggi e la sua pausa:
  // si può giocare su entrambi nello stesso momento.
  const newCourt = () => ({
    phase: "idle", // idle | starting | queued | in_progress | refreshing
    message: null,
    messageKind: "info", // "info" oppure "warning" (avviso evidenziato)
    following: false, // true mentre la pagina segue un'esecuzione di questo campetto
    waiting: false, // true se l'esecuzione seguita è in coda dietro un'altra
    justUpdated: false,
    showWhy: false, // spiegazione "Perché devo aspettare?" aperta
    live: { seen: {}, allDoneAt: null, shown: 0, target: 0, startedAt: 0, since: 0, lastFrame: 0 },
    shots: newShots(),
  });
  // Tiri a canestro della partita seguita: già visti, in coda, punteggio.
  function newShots() {
    return { seen: {}, results: {}, primed: false, queue: [], playing: false, last: null, lastAt: 0, node: null, dribble: null };
  }
  // L'ordine delle schede nella pagina: Funzionalità, Sicurezza, Marketing, SEO.
  const courts = { functional: newCourt(), security: newCourt(), marketing: newCourt(), seo: newCourt() };
  const AREAS = Object.keys(courts);
  const GAME_MINUTES = { functional: 3, seo: 1, marketing: 2, security: 1 }; // durata tipica di una partita, per le spiegazioni
  // Campetti "a sé": un solo browser (Chrome), niente schede per browser, la loro ultima partita.
  const COURT_SECTIONS = ["seo", "marketing", "security"];
  const areaOfSection = (section) => (COURT_SECTIONS.includes(section) ? section : "functional");
  const currentArea = () => areaOfSection(state.section);
  const C = () => courts[currentArea()]; // il campetto aperto nella pagina

  // Stato di un campetto da /status. Il plugin precedente (un solo campetto) non ha "courts":
  // in quel caso tutto vale per Funzionalità e la Sicurezza non si può avviare.
  function courtStatus(area) {
    const st = state.status;
    if (!st) return null;
    if (st.courts) return { configured: st.configured, ...(st.courts[area] || {}) };
    return area === "functional" ? st : { configured: false };
  }

  // Statistiche delle visite (Google Analytics, solo con il consenso del visitatore: gtag rispetta
  // la scelta fatta nel banner dei cookie). Nessun dato personale: solo quale scheda o campetto.
  function track(event, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", event, params);
    } catch (e) {
      // Le statistiche non devono mai interferire con la pagina.
    }
  }

  /* ---------- Dati ---------- */

  async function getJson(url, options) {
    const res = await fetch(url, Object.assign({ cache: "no-store" }, options));
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  }

  // Feature nascoste dalla vetrina pubblica: restano nel summary.json (le legge la pagina riservata),
  // ma non vengono mostrate qui nella Playground. I conteggi si ricalcolano dai test rimasti (groupByBrowser).
  // La SEO base ora ha il suo campetto (area "seo"): nei summary precedenti era tra i controlli funzionali,
  // quindi lì la nascondiamo finché la prima esecuzione nuova non la sposta.
  const isLegacySeo = (t) => t.feature === "SEO" && t.area !== "seo";
  // GitHub Pages tiene i file in cache per qualche minuto: il parametro ?t= forza la versione aggiornata.
  const loadSummary = async () => {
    const s = (await getJson(cfg.summaryUrl + "?t=" + Date.now())).body;
    if (s && Array.isArray(s.tests)) s.tests = s.tests.filter((t) => !isLegacySeo(t));
    return s;
  };
  const loadStatus = async () => (await getJson(cfg.statusUrl)).body;

  // Testo nella lingua della pagina, con l'italiano come riserva se manca la traduzione.
  const titleOf = (t) => (LANG === "en" && t.en && t.en.title) || t.title;
  const featureOf = (t) => (LANG === "en" && t.en && t.en.feature) || t.feature || T.other;
  const explainOf = (t) => (t.explain && t.explain[LANG] && t.explain[LANG].what ? t.explain[LANG] : null);

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
      <p class="qlp-chart-note">${esc(isMobileSection() ? T.chartNoteMobile : T.chartNote)}${
        s.totalMs && s.totalMs > max ? " " + esc(T.overhead(minutes(s.totalMs - max))) : ""
      }</p>
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
    // Controlli di sicurezza: stesso risultato con qualsiasi browser, quindi girano solo su Chrome.
    // Hanno il loro campetto: il pulsante avvia solo questi controlli (circa un minuto).
    security: {
      names: { chromium: "Chrome" },
      families: { chromium: ["chromium"] },
      run: { all: "security" },
    },
    // SEO base e Marketing: come la Sicurezza, un solo browser e un pulsante che avvia solo quei controlli.
    seo: {
      names: { chromium: "Chrome" },
      families: { chromium: ["chromium"] },
      run: { all: "seo" },
    },
    marketing: {
      names: { chromium: "Chrome" },
      families: { chromium: ["chromium"] },
      run: { all: "marketing" },
    },
  };
  let BROWSER_NAMES, FAMILIES, FAMILY_OF, RUN_KEY;
  function setSection(section) {
    state.section = section;
    ({ names: BROWSER_NAMES, families: FAMILIES, run: RUN_KEY } = SECTIONS[section]);
    FAMILY_OF = Object.fromEntries(Object.entries(FAMILIES).flatMap(([f, vs]) => vs.map((v) => [v, f])));
  }
  const isMobileSection = () => state.section === "mobile";
  const isSecuritySection = () => state.section === "security";
  const isCourtSection = () => COURT_SECTIONS.includes(state.section); // SEO, Marketing o Sicurezza
  // Ogni controllo compare in una sola sezione: quelli di sicurezza nella loro, gli altri in Computer
  // e Smartphone. I summary più vecchi non hanno "area": sono tutti controlli funzionali.
  const inSection = (t) => (t.area || "functional") === areaOfSection(state.section);

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
    const tests = s.tests.filter(inSection).map((t) => {
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
    // Nella Sicurezza: l'ultima partita di sicurezza (che può essere più recente di quella dei browser).
    const courtRun = isCourtSection() && ((s.areaRuns && s.areaRuns[state.section]) || (isSecuritySection() && s.securityRun));
    const latestRun = courtRun
      ? courtRun
      : Object.values(runs).reduce((a, b) => (!a || new Date(b.startedAt) > new Date(a.startedAt) ? b : a), null);
    return {
      ...s,
      startedAt: (latestRun && latestRun.startedAt) || s.startedAt,
      // Durata totale su GitHub dell'ultima esecuzione che ha toccato questa sezione.
      totalMs: (latestRun && latestRun.totalMs) || null,
      trigger: (latestRun && latestRun.trigger) || s.trigger,
      tests,
      checks: tests.length,
      runs,
      browsers: fams,
      total: all.length,
      passed: count("passed"),
      failed: count("failed"),
      broken: count("broken"),
      skipped,
      successRate: verified ? Math.round((count("passed") / verified) * 1000) / 10 : 0,
      status: !verified ? "unverified" : count("failed") + count("broken") === 0 ? "passed" : "failed",
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
    // Solo le tipologie presenti nella sezione (es. la Sicurezza non ha controlli Smoke).
    const types = Object.keys(TYPE_NAMES).filter((type) => s.tests.some((t) => t.type === type));
    if (types.length) {
      groups.push([T.legendTypes, types.map((type) => [renderType(type), T.types[type][1]])]);
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

  // Finestra ⓘ: spiegazione di un controllo in parole semplici (cosa verifica e perché conta).
  // Come "Come funziona?", è creata una volta sola e aggiunta a <body>.
  let explainBox = null;
  function explainDialog(t) {
    if (!explainBox) {
      explainBox = document.createElement("dialog");
      explainBox.className = "qlp qlp-modal";
      explainBox.setAttribute("aria-labelledby", "qlp-explain-title");
      explainBox.setAttribute("data-no-translation", "");
      explainBox.addEventListener("click", (e) => {
        if (e.target === explainBox) explainBox.close();
      });
      document.body.appendChild(explainBox);
    }
    const e = explainOf(t);
    explainBox.innerHTML = `
      <h3 id="qlp-explain-title">${esc(titleOf(t))}</h3>
      <h4>${esc(T.explainWhat)}</h4>
      <p>${esc(e.what)}</p>
      ${e.why ? `<h4>${esc(T.explainWhy)}</h4><p>${esc(e.why)}</p>` : ""}
      <form method="dialog"><button type="submit" class="qlp-run">${esc(T.close)}</button></form>`;
    return explainBox;
  }

  /* ---------- Avanzamento in diretta ---------- */
  // Durante un'esecuzione i test comunicano a WordPress "iniziato / superato / fallito" (status.progress).
  // Da qui ricaviamo lo stato di ogni controllo e una barra che si riempie in modo continuo,
  // agganciata ai dati reali: non supera mai il punto successivo e non torna mai indietro.

  const ALL_TEST_BROWSERS = ["chromium", "msedge", "firefox", "webkit", "iphone", "android", "fold", "ipad", "ipadland"];
  const SETUP_MS = 75000; // durata tipica della preparazione dei browser su GitHub
  const PUBLISH_MS = 30000; // durata tipica della pubblicazione dei risultati

  // "since": l'esecuzione da seguire è quella creata dopo questo istante (non quella precedente, già finita).
  function resetLive(c, since) {
    const live = c.live;
    live.seen = {};
    live.allDoneAt = null;
    live.shown = 0;
    live.target = 0;
    live.startedAt = Date.now();
    live.since = since || 0;
    if (c.shots) stopDribble(c.shots);
    c.shots = newShots(); // nuova partita: punteggio da zero
  }

  // L'esecuzione nello stato è quella che stiamo seguendo?
  const isFollowedRun = (c, run) => run && new Date(run.createdAt).getTime() >= c.live.since;

  // Varianti coinvolte nell'esecuzione, dal titolo (es. "E2E · website · safari"); altrimenti tutte.
  function runBrowsers(run) {
    const m = run && run.title && run.title.match(/·\s*([a-z]+)\s*$/);
    if (!m) return ALL_TEST_BROWSERS;
    if (m[1] === "desktop") return Object.values(SECTIONS.desktop.families).flat();
    if (m[1] === "mobile") return ["iphone", "android", "ipad", "ipadland"]; // il Fold solo in automatico
    if (m[1] === "ipad") return SECTIONS.mobile.families.ipad;
    if (COURT_SECTIONS.includes(m[1])) return ["chromium"];
    return ALL_TEST_BROWSERS.includes(m[1]) ? [m[1]] : ALL_TEST_BROWSERS;
  }

  // Avanzamento della partita del campetto aperto (null se non ce n'è una da seguire).
  function liveInfo() {
    const c = C();
    const live = c.live;
    const st = courtStatus(currentArea());
    if (!c.following || !st || !isFollowedRun(c, st.run) || !state.summary) return null;
    const browsers = runBrowsers(st.run);
    const progress = st.progress || {};
    const tests = state.summary.tests.filter((t) => t.key && inSection(t)); // solo i controlli della sezione aperta
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
    const c = C();
    const live = c.live;
    const now = Date.now();
    if (c.phase === "refreshing") return 100; // esecuzione finita, risultati in arrivo
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
    const c = C();
    if (c.phase === "starting") return T.live.starting;
    if (c.phase === "refreshing") return T.live.publish;
    if (c.waiting) return T.waiting;
    if (!info || info.done + info.current.length === 0) return T.live.setup;
    if (info.done >= info.total) return T.live.publish;
    // L'esecuzione riguarda solo l'altra sezione: niente conteggio dei controlli di questa.
    if (!info.checksTotal) return T.live.other;
    return T.live.tests(info.checksDone, info.checksTotal);
  }

  function renderLiveProgress() {
    const c = C();
    const live = c.live;
    if (c.phase === "idle") return "";
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
      ${["starting", "queued", "in_progress"].includes(c.phase) || Object.keys(c.shots.results).length ? '<div class="qlp-shot-slot"></div>' : ""}
    </div>`;
  }

  /* ---------- Tiri a canestro durante la partita ---------- */
  // Ogni controllo che finisce su un browser è un tiro: se passa, canestro pulito; se non passa,
  // la palla prende il ferro ed esce. Il riquadro è un elemento solo, che sopravvive ai ridisegni
  // della pagina (ogni 5 secondi), così un'animazione in corso non riparte da capo.

  const SHOT_NAMES = {
    chromium: "Chrome", msedge: "Edge", firefox: "Firefox", webkit: "Safari",
    iphone: "iPhone", android: "Android", ipad: "iPad", ipadland: "iPad", fold: "Galaxy Fold",
  };
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function shotWidget(c) {
    const sh = c.shots;
    if (!sh.node) {
      sh.node = document.createElement("div");
      sh.node.className = "qlp-shot";
      sh.node.dataset.pose = "dribble";
      sh.node.innerHTML = `
        <svg viewBox="0 0 240 130" aria-hidden="true" focusable="false">
          <line x1="0" y1="124" x2="240" y2="124" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
          <line x1="210" y1="14" x2="210" y2="76" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
          <g class="qlp-shot-net" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.4" stroke-linecap="round">
            <path d="M170 54 L177 82 M178 54 L181.5 82 M186 54 L186 82 M194 54 L190.5 82 M202 54 L195 82"/>
            <path d="M170 54 L179.8 68 L177 82 M178 54 L173.5 68 L181.5 82 M178 54 L186.0 68 L181.5 82 M186 54 L179.8 68 L186 82 M186 54 L192.2 68 L186 82 M194 54 L186.0 68 L190.5 82 M194 54 L198.5 68 L190.5 82 M202 54 L192.2 68 L195 82" stroke-opacity="0.6"/>
            <path d="M172.3 63.2 H199.7 M174.6 72.5 H197.4 M177.0 82.0 H195.0" stroke-opacity="0.5"/>
          </g>
          <line class="qlp-shot-rim" x1="168" y1="52" x2="204" y2="52" stroke="#f97316" stroke-width="5" stroke-linecap="round"/>

          <!-- Il giocatore: palleggia in attesa, tira a ogni controllo, poi esulta o si dispera.
               Le braccia cambiano con la "posa" (attributo data-pose sul riquadro). -->
          <g class="qlp-player" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <g class="qlp-head"><circle cx="104" cy="76" r="6" fill="#ffffff" stroke="none"/></g>
            <path d="M104 84 V104 M104 104 L99 123 M104 104 L110 123"/>
            <path class="qlp-arms qlp-arms-dribble" d="M101 88 L92 99 M107 88 L113 97"/>
            <path class="qlp-arms qlp-arms-gather" d="M101 88 L110 96 L114 92 M107 88 L116 93"/>
            <path class="qlp-arms qlp-arms-shoot" d="M101 88 L97 66 M107 88 L112 66"/>
            <path class="qlp-arms qlp-arms-cheer" d="M101 88 L89 65 M107 88 L120 65"/>
            <path class="qlp-arms qlp-arms-sad" d="M101 88 L91 81 L98 75 M107 88 L117 81 L110 75"/>
          </g>
          <!-- Palla del palleggio (accanto al giocatore) e palla del tiro (in volo) -->
          <g class="qlp-dribble-ball" style="transform: translate(89px, 106px)">
            <circle r="7.5" fill="#f97316" stroke="#7c2d12" stroke-width="1.2"/>
            <path d="M-7.5 0 H7.5 M0 -7.5 V7.5" stroke="#7c2d12" stroke-width="1" fill="none"/>
          </g>
          <g class="qlp-shot-ball" style="transform: translate(105px, 57px); opacity: 0">
            <circle r="7.5" fill="#f97316" stroke="#7c2d12" stroke-width="1.2"/>
            <path d="M-7.5 0 H7.5 M0 -7.5 V7.5" stroke="#7c2d12" stroke-width="1" fill="none"/>
          </g>
        </svg>
        <div class="qlp-shot-text">
          <p class="qlp-shot-caption"></p>
          <p class="qlp-shot-score"></p>
        </div>`;
    }
    updateShotText(c);
    return sh.node;
  }

  // Il riquadro racconta solo la parte di partita che si sta guardando: la sezione aperta
  // (es. Computer: Chrome, Edge, Firefox, Safari) e, se scelta, la scheda di un solo browser.
  function shotInView(b) {
    const f = FAMILY_OF[b];
    return Boolean(f) && (state.view === "all" || state.view === f);
  }

  function updateShotText(c) {
    const sh = c.shots;
    if (!sh.node) return;
    let made = 0;
    let missed = 0;
    for (const r of Object.values(sh.results)) {
      if (!shotInView(r.b)) continue;
      if (r.result === "passed") made++;
      else missed++;
    }
    sh.made = made;
    sh.missed = missed;
    const shot = sh.last && shotInView(sh.last.b) ? sh.last : null;
    const recent = shot && (sh.playing || Date.now() - sh.lastAt < 2500);
    sh.node.querySelector(".qlp-shot-caption").textContent = recent
      ? (shot.result === "passed" ? T.shot.made : T.shot.missed)(shot.title, shot.where)
      : phaseCaption(c) || (shot ? (shot.result === "passed" ? T.shot.made : T.shot.missed)(shot.title, shot.where) : T.shot.phase.setup);
    sh.node.querySelector(".qlp-shot-score").textContent = T.shot.score(made, missed);
  }

  // Cosa sta facendo l'esecuzione su GitHub, con le parole del campetto.
  function phaseCaption(c) {
    if (c.phase === "starting") return T.shot.phase.starting;
    if (c.phase === "refreshing") return T.shot.phase.publish;
    if (c.waiting) return T.shot.phase.waiting;
    const info = c === C() ? liveInfo() : null;
    if (!info || info.done + info.current.length === 0) return T.shot.phase.setup;
    const now = info.current.find((x) => shotInView(x.b));
    if (now) return T.shot.phase.playing(titleOf(now.t), SHOT_NAMES[now.b] || now.b);
    if (info.total && info.done >= info.total) return T.shot.phase.publish;
    return null; // tra un controllo e l'altro resta l'ultimo tiro
  }

  // Controlli finiti dall'ultimo aggiornamento: diventano tiri in coda.
  function collectShots(area, st) {
    const c = courts[area];
    const sh = c.shots;
    if (!st || !st.run || !isFollowedRun(c, st.run)) return;
    const known = new Map(((state.summary && state.summary.tests) || []).map((t) => [t.key, t]));
    const fresh = [];
    for (const [b, p] of Object.entries(st.progress || {})) {
      for (const [key, result] of Object.entries((p && p.tests) || {})) {
        if (result !== "passed" && result !== "failed") continue; // i "non verificabili" non sono tiri
        const t = known.get(key);
        if (t && (t.area || "functional") !== area) continue; // controlli di un altro campetto
        const id = b + "|" + key;
        sh.results[id] = { b, result }; // per il punteggio, filtrato poi sulla vista aperta
        if (sh.seen[id]) continue;
        sh.seen[id] = true;
        // Pagina aperta a partita iniziata: i tiri già fatti contano nel punteggio, ma non si rigiocano.
        if (sh.primed) fresh.push({ b, result, title: t ? titleOf(t) : key, where: SHOT_NAMES[b] || b });
      }
    }
    sh.primed = true;
    updateShotText(c);
    // Gli aggiornamenti arrivano ogni 5 secondi, anche con più tiri insieme: ne teniamo in coda
    // al massimo 3, così l'animazione resta al passo con la partita.
    sh.queue = sh.queue.concat(fresh).slice(-3);
    playNextShot(c);
  }

  // In attesa dei risultati il giocatore palleggia: si vede subito che la partita è iniziata,
  // anche nel minuto in cui GitHub prepara le macchine e non ci sono ancora tiri.
  function startDribble(c) {
    const sh = c.shots;
    if (sh.dribble || sh.playing || !sh.node || !sh.node.isConnected || reducedMotion() || !sh.node.animate) return;
    sh.node.dataset.pose = "dribble";
    const at = (y, easing) => ({ transform: `translate(89px, ${y}px)`, easing });
    const arm = (y, easing) => ({ d: `path("M101 88 L92 ${y} M107 88 L113 97")`, easing });
    const timing = { duration: 620, iterations: Infinity };
    sh.dribble = [
      // la palla scende fino a terra (pavimento meno il raggio) e torna alla mano
      sh.node.querySelector(".qlp-dribble-ball").animate([at(106, "ease-in"), at(116.5, "ease-out"), at(106, "linear")], timing),
      // la mano accompagna la palla (dove il browser lo permette: Safari la lascia ferma)
      sh.node.querySelector(".qlp-arms-dribble").animate([arm(99, "ease-in"), arm(104, "ease-out"), arm(99, "linear")], timing),
    ];
  }
  function stopDribble(sh) {
    if (sh.dribble) sh.dribble.forEach((a) => a.cancel());
    sh.dribble = null;
  }

  function playNextShot(c) {
    const sh = c.shots;
    // I tiri degli altri browser o dispositivi (es. gli smartphone mentre si guarda Computer) non si giocano.
    while (sh.queue.length && !shotInView(sh.queue[0].b)) sh.queue.shift();
    if (sh.playing || !sh.queue.length) return;
    const shot = sh.queue.shift();
    sh.playing = true;
    sh.last = shot;
    sh.lastAt = Date.now();
    updateShotText(c);
    const done = () => {
      sh.playing = false;
      sh.lastAt = Date.now();
      setTimeout(() => updateShotText(c), 2600); // dopo il tiro la didascalia torna a seguire la CI
      setTimeout(() => {
        playNextShot(c);
        startDribble(c); // nessun altro tiro in coda: si torna a palleggiare
      }, 300);
    };
    // Campetto non visibile o animazioni ridotte nelle preferenze del sistema: solo il testo.
    if (!sh.node || !sh.node.isConnected || reducedMotion() || !sh.node.animate) {
      setTimeout(done, 400);
      return;
    }
    const node = sh.node;
    const player = node.querySelector(".qlp-player");
    const made = shot.result === "passed";

    // 1. Si ferma e raccoglie la palla al petto, poi la alza sopra la testa, salta e la rilascia.
    //    La palla resta tra le sue mani fino al rilascio, nel punto più alto del salto.
    const DURATION = 1700;
    stopDribble(sh);
    node.dataset.pose = "gather";
    setTimeout(() => node.isConnected && (node.dataset.pose = "shoot"), 170);
    player.animate([{ transform: "translateY(0)" }, { transform: "translateY(-8px)" }, { transform: "translateY(0)" }], {
      duration: 440, delay: 360, easing: "ease-out",
    });

    // 2. La palla: dal palleggio al petto (mani in avanti), sopra la testa (mani alzate),
    //    su con il salto e, dal punto più alto, la parabola verso il ferro.
    const at = (x, y, offset, opacity = 1) => ({ transform: `translate(${x}px, ${y}px)`, offset, opacity });
    const RELEASE = 0.34; // istante del rilascio, in proporzione alla durata
    const arc = (x1, y1, upto) =>
      Array.from({ length: 10 }, (_, i) => {
        const k = (i + 1) / 10;
        return at(105 + (x1 - 105) * k, 50 + (y1 - 50) * k - 120 * k * (1 - k), RELEASE + (upto - RELEASE) * k);
      });
    const start = [at(89, 106, 0), at(115, 89, 0.1), at(105, 58, 0.22), at(105, 50, RELEASE)];
    const frames = made
      ? [...start, ...arc(186, 42, 0.66), at(186, 66, 0.78), at(186, 100, 0.9), at(186, 116, 1, 0)]
      : [...start, ...arc(166, 40, 0.62), at(150, 18, 0.74), at(142, 112, 0.88), at(134, 100, 0.94), at(126, 114, 1, 0)];
    const ball = node.querySelector(".qlp-shot-ball").animate(frames, { duration: DURATION, easing: "linear" });
    if (made) {
      node.querySelector(".qlp-shot-net").animate([{ transform: "scaleY(1)" }, { transform: "scaleY(1.3)" }, { transform: "scaleY(1)" }], {
        duration: 380, delay: DURATION * 0.68, easing: "ease-out",
      });
    } else {
      node.querySelector(".qlp-shot-rim").animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0deg)" }],
        { duration: 360, delay: DURATION * 0.62, easing: "ease-out" },
      );
    }

    // 3. Appena si vede com'è andata: esulta (braccia a V e due saltelli)
    //    oppure si dispera (mani sulla testa, si abbassa e scuote la testa).
    let reaction = null;
    setTimeout(() => {
      if (!node.isConnected) return;
      node.dataset.pose = made ? "cheer" : "sad";
      reaction = made
        ? player.animate(
            [0, -7, 0, -7, 0].map((y) => ({ transform: `translateY(${y}px)` })),
            { duration: 900, easing: "ease-in-out" },
          )
        : Promise.all([
            player.animate([{ transform: "translateY(0)" }, { transform: "translateY(4px)" }, { transform: "translateY(4px)" }], {
              duration: 1000, easing: "ease-out",
            }).finished,
            node.querySelector(".qlp-head").animate(
              [0, -14, 12, -10, 6, 0].map((deg) => ({ transform: `translateY(3px) rotate(${deg}deg)` })),
              { duration: 1000, easing: "ease-in-out" },
            ).finished,
          ]);
    }, DURATION * 0.66);

    // 4. Finita la reazione si riprende a palleggiare (o si tira di nuovo, se ci sono altri risultati).
    ball.finished
      .then(() => new Promise((r) => setTimeout(r, 450)))
      .then(() => (reaction && reaction.finished ? reaction.finished : reaction))
      .catch(() => {})
      .then(done);
  }

  // Animazione continua: a ogni passo la barra si avvicina al valore vero, senza mai tornare indietro.
  // Anima la barra del campetto aperto; quella dell'altro riparte dal valore vero quando lo si riapre.
  function tick() {
    const c = C();
    const live = c.live;
    if (c.phase === "idle") return;
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
    if (Date.now() - C().live.lastFrame > 500) tick();
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
        // Sicurezza: i controlli girano su Chrome insieme a quelli funzionali, quindi la durata
        // della macchina non dice nulla. Mostriamo la somma dei soli controlli di sicurezza.
        durationMs: isCourtSection()
          ? s.tests.reduce((sum, t) => sum + ((t.durations && t.durations.chromium) || 0), 0)
          : totalDuration(s),
        totalMs: isCourtSection() ? null : s.totalMs || null,
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
      totalMs: run.totalMs || null,
      startedAt: run.startedAt ?? s.startedAt,
      trigger: run.trigger ?? s.trigger,
      status: !verified ? "unverified" : passed === verified ? "passed" : "failed",
    };
  }

  // Primo livello: Funzionalità oppure Sicurezza.
  function renderAreas() {
    return `<div class="qlp-areas" role="group" aria-label="${esc(T.areasLabel)}">${AREAS.map(
      (area) =>
        `<button type="button" class="qlp-area" data-area="${area}" aria-pressed="${currentArea() === area}">${esc(T.areas[area])}</button>`,
    ).join("")}</div>`;
  }

  // Indirizzo della scheda Sicurezza, da condividere. Due forme:
  //   ?campo=sicurezza  (consigliata nei link: sopravvive a redirect, CAPTCHA e browser delle app,
  //                      che a volte perdono la parte dopo il #)
  //   #sicurezza        (quella che la pagina scrive nella barra quando si cambia scheda)
  // In inglese: ?court=security e #security; le due lingue accettano entrambe.
  const SECURITY_HASH = LANG === "en" ? "#security" : "#sicurezza";
  const SECURITY_PARAMS = ["campo", "court"];
  const isSecurityValue = (v) => /^(sicurezza|security|difesa|defense)$/i.test(v || "");
  const isSecurityHash = () =>
    isSecurityValue(location.hash.slice(1)) ||
    SECURITY_PARAMS.some((p) => isSecurityValue(new URLSearchParams(location.search).get(p)));
  // Anche SEO e Marketing hanno il loro indirizzo: #seo / #marketing oppure ?campo=seo, ?court=marketing.
  const COURT_HASH = { security: SECURITY_HASH, seo: "#seo", marketing: "#marketing" };
  function courtFromLocation() {
    if (isSecurityHash()) return "security";
    const values = [location.hash.slice(1), ...SECURITY_PARAMS.map((p) => new URLSearchParams(location.search).get(p))]
      .map((v) => (v || "").toLowerCase());
    return ["seo", "marketing"].find((c) => values.includes(c)) || null;
  }
  // L'indirizzo senza il parametro della scheda (gli altri, es. utm_*, restano per le statistiche).
  function searchWithoutCourt() {
    const params = new URLSearchParams(location.search);
    SECURITY_PARAMS.forEach((p) => params.delete(p));
    const s = params.toString();
    return s ? "?" + s : "";
  }

  function openArea(area) {
    if (area === currentArea()) return;
    if (COURT_SECTIONS.includes(area)) {
      if (!isCourtSection()) state.lastFunctionalSection = state.section;
      setSection(area);
    } else {
      setSection(state.lastFunctionalSection);
    }
    state.view = "all";
    // L'indirizzo segue la scheda, senza aggiungere voci alla cronologia del browser.
    // Tornando a Funzionalità togliamo anche ?campo=sicurezza, altrimenti ricaricando si riaprirebbe la Sicurezza.
    history.replaceState(null, "", location.pathname + searchWithoutCourt() + (COURT_HASH[area] || ""));
    track("playground_tab", { area, section: state.section });
    render();
  }

  // Secondo livello (solo in Funzionalità): computer oppure smartphone e tablet.
  function renderSections() {
    if (isCourtSection()) return "";
    return `<div class="qlp-sections" role="group" aria-label="${esc(T.sectionsLabel)}">${["desktop", "mobile"]
      .map(
        (key) =>
          `<button type="button" class="qlp-section" data-section="${key}" aria-pressed="${state.section === key}">${esc(T.sections[key])}</button>`,
      )
      .join("")}</div>`;
  }

  function renderTabs(s) {
    if (isCourtSection()) return ""; // un solo browser: niente schede
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

  // Tempo: la durata totale su GitHub (quella che aspetta chi avvia i controlli) e, sotto,
  // il tempo dei soli test. I riepiloghi più vecchi non hanno la durata totale: solo i test.
  function renderDurationStat(d) {
    const parallel = state.view === "all" ? (isMobileSection() ? T.parallelDevices : T.parallelBrowsers) : "";
    if (!d.totalMs) {
      const label = isCourtSection()
        ? { security: T.durationSecurity, seo: T.durationSeo, marketing: T.durationMarketing }[state.section]
        : state.view === "all" ? (isMobileSection() ? T.durationAllMobile : T.durationAll) : T.duration;
      return `<div class="qlp-stat"><span class="qlp-num">${minutes(d.durationMs)}</span><span class="qlp-label">${esc(label)}</span></div>`;
    }
    return `<div class="qlp-stat"><span class="qlp-num">${minutes(d.totalMs)}</span><span class="qlp-label">${esc(T.totalDuration)}</span><span class="qlp-sub">${esc(T.testsPart(minutes(d.durationMs), parallel))}</span></div>`;
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
    // Esito in alto: verde, rosso oppure giallo quando l'hosting ha bloccato tutti i controlli.
    const [pillClass, pillText] =
      d.status === "unverified" ? ["qlp-unk", T.siteUnverified] : ok ? ["qlp-ok", T.siteOk] : ["qlp-ko", T.siteKo];
    const byFeature = {};
    const listed = state.priority === "all" ? d.tests : d.tests.filter((t) => priorityOf(t) === state.priority);
    for (const t of listed) (byFeature[featureOf(t)] ||= []).push(t);

    const body = d.tests.length
      ? `
        <h3 class="qlp-results-title">${esc(T.resultsTitle)}</h3>
        <div class="qlp-head">
          <span class="qlp-pill ${pillClass}">
            <span class="qlp-dot"></span>${esc(pillText)}
          </span>
          <span class="qlp-meta">${esc(T.lastRun(timeAgo(d.startedAt), T.triggers[d.trigger] || d.trigger))}</span>
        </div>

        <div class="qlp-stats">
          <div class="qlp-stat"><span class="qlp-num">${d.passed}/${d.total}</span><span class="qlp-label">${esc(T.checksPassed)}</span></div>
          <div class="qlp-stat"><span class="qlp-num">${d.status === "unverified" ? "—" : d.successRate.toLocaleString(LANG) + "%"}</span><span class="qlp-label">${esc(T.successRate)}</span></div>
          ${renderDurationStat(d)}
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
            .map(([feature, tests]) => {
              // Se il gruppo ha controlli di un solo tipo, il tipo sta nell'intestazione;
              // altrimenti (es. Sicurezza: HTTPS e certificato sono smoke, il resto regression) su ogni riga.
              const mixed = new Set(tests.map((t) => t.type)).size > 1;
              return `
            <div class="qlp-group">
              <h4>${esc(feature)}${mixed ? "" : renderType(tests[0].type)}</h4>
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
                      <span class="qlp-name">${esc(titleOf(t))}${mixed ? renderType(t.type) : ""}${t.priority ? ` ${renderPriority(priorityOf(t))}` : ""}${
                        explainOf(t)
                          ? ` <button type="button" class="qlp-info" data-key="${esc(t.key)}" aria-haspopup="dialog" aria-label="${esc(T.explainButton(titleOf(t)))}" title="${esc(T.explainButton(titleOf(t)))}">i</button>`
                          : ""
                      }</span>
                      ${state.view === "all" && !isCourtSection() ? renderBrowsers(t, info) : ""}
                      <span class="qlp-dur">${liveRow ? "—" : seconds(ms)}</span>
                    </li>`;
                  })
                  .join("")}
              </ul>
            </div>`;
            })
            .join("")}
        </div>`
      : `<p class="qlp-empty">${esc(T.noResults)}</p>`;

    root.innerHTML = `
      <div class="qlp-card ${C().justUpdated ? "qlp-updated" : ""}">
        ${renderAreas()}
        ${renderSections()}
        ${renderTabs(s)}
        <div class="qlp-actions">
          ${renderButton()}
        </div>
        ${
          isCourtSection()
            ? `<p class="qlp-device-note">${esc({ security: T.securityNote, seo: T.seoNote, marketing: T.marketingNote }[state.section])}</p>${
                isSecuritySection() && courtStatus("security") && courtStatus("security").manualOnly
                  ? `<div class="qlp-owner-only" role="note"><p class="qlp-owner-only-title">${esc(T.ownerOnlyTitle)}</p><p>${esc(T.ownerOnly)}</p></div>`
                  : ""
              }`
            : isMobileSection()
            ? `<p class="qlp-device-note">${esc(T.mobileNote)}</p>`
            : isMobileVisitor()
              ? `<p class="qlp-device-note">${esc(T.mobileVisitor)}</p>`
              : ""
        }
        ${renderLiveProgress()}
        ${C().message ? `<p class="qlp-message qlp-message-${C().messageKind}" role="status">${esc(C().message)}</p>` : renderCourtNote()}
        ${body}
      </div>`;

    const shotSlot = root.querySelector(".qlp-shot-slot");
    if (shotSlot) {
      shotSlot.replaceWith(shotWidget(C()));
      startDribble(C());
    }
    const btn = root.querySelector(".qlp-run");
    if (btn) btn.addEventListener("click", startRun);
    const whyLink = root.querySelector(".qlp-why-link");
    if (whyLink)
      whyLink.addEventListener("click", () => {
        C().showWhy = !C().showWhy;
        render();
      });
    root.querySelectorAll(".qlp-info").forEach((b) =>
      b.addEventListener("click", () => {
        const t = state.summary.tests.find((x) => x.key === b.dataset.key);
        if (!t) return;
        track("playground_explain", { area: t.area || "functional", check: t.method || t.key });
        explainDialog(t).showModal();
      }),
    );
    const how = root.querySelector(".qlp-how-link");
    if (how) how.addEventListener("click", () => howDialog().showModal());
    root.querySelectorAll(".qlp-filter-btn").forEach((b) =>
      b.addEventListener("click", () => {
        state.priority = b.dataset.priority;
        render();
      }),
    );
    root.querySelectorAll(".qlp-area").forEach((b) =>
      b.addEventListener("click", () => openArea(b.dataset.area)),
    );
    root.querySelectorAll(".qlp-section").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.section === state.section) return;
        setSection(b.dataset.section);
        state.view = "all";
        track("playground_tab", { area: "functional", section: b.dataset.section });
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

  // Pausa di 10 minuti tra una partita e l'altra (limite del plugin): spieghiamo perché il pulsante aspetta.
  function renderCourtNote() {
    const st = courtStatus(currentArea());
    if (C().phase !== "idle" || !st || !st.configured || !(st.cooldownRemaining > 0)) return "";
    if (st.run && st.run.status !== "completed") return "";
    return `<p class="qlp-message qlp-message-info" role="status">${esc(T.courtCleaning(Math.ceil(st.cooldownRemaining / 60)))}</p>`;
  }

  function renderButton() {
    const c = C();
    const area = currentArea();
    const st = courtStatus(area);
    let label = state.view === "all" ? T.runNow : T.runOn(BROWSER_NAMES[state.view]);
    let disabled = false;
    let why = ""; // spiegazione nel tooltip quando il pulsante aspetta

    if (!st || !st.configured) {
      return ""; // senza token il pulsante non viene mostrato
    } else if (st.manualOnly) {
      label = T.manualOnly; // es. Sicurezza: solo a mano, d'accordo con l'hosting
      disabled = true; // il motivo è spiegato nel riquadro sotto il pulsante, sempre visibile
    } else if (!RUN_KEY[state.view]) {
      label = T.autoOnly; // es. Galaxy Fold: solo nelle esecuzioni automatiche
      disabled = true;
    } else if (c.phase !== "idle" || (st.run && st.run.status !== "completed")) {
      label = T.running;
      disabled = true;
      why = T.whyBusy(GAME_MINUTES[area]);
    } else if (st.cooldownRemaining > 0) {
      label = T.availableIn(Math.ceil(st.cooldownRemaining / 60));
      disabled = true;
      why = T.whyCleaning(Math.round((st.cooldown || 600) / 60));
    }
    const button = `<button type="button" class="qlp-run" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
    if (!why) {
      c.showWhy = false; // il campetto è libero: la prossima volta la spiegazione riparte chiusa
      return button;
    }
    // Un pulsante disattivato non mostra il tooltip in tutti i browser: lo mettiamo sul contenitore.
    // Il tooltip però si vede solo con il mouse: accanto c'è un link visibile anche su telefono,
    // che apre la spiegazione sotto il pulsante.
    return `<span class="qlp-run-wrap" title="${esc(why)}">${button}</span>
      <button type="button" class="qlp-why-link" aria-expanded="${c.showWhy}" aria-controls="qlp-why">ⓘ ${esc(T.whyLink)}</button>
      ${c.showWhy ? `<p id="qlp-why" class="qlp-why">${esc(why)}</p>` : ""}`;
  }



  /* ---------- Avvio e attesa dei test ---------- */

  async function startRun() {
    const area = currentArea();
    const c = courts[area];
    resetLive(c, Date.now() - 10000);
    c.phase = "starting";
    c.message = null;
    c.justUpdated = false;
    render();

    // Avvia i controlli sulla scheda selezionata ("all" = tutta la sezione: computer o dispositivi;
    // nel campetto Sicurezza, i controlli di sicurezza).
    const target = RUN_KEY[state.view];
    track("playground_run", { area, target });
    const res = await getJson(cfg.runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser: target }),
    });
    const body = res.body || {};

    if (res.status === 202) {
      return follow(area, new Date(body.startedAt).getTime() - 10000);
    }
    if (body.reason === "running") {
      // Il pulsante era ancora visibile, ma c'era già un'esecuzione: avvisiamo e la seguiamo.
      c.message = T.msgFollowing;
      c.messageKind = "warning";
      return follow(area, new Date(body.run.createdAt).getTime() - 1000);
    }

    c.phase = "idle";
    c.messageKind = "warning";
    c.message = body.reason === "cooldown" ? T.msgCooldown(Math.ceil(body.cooldownRemaining / 60)) : T.msgError;
    state.status = await loadStatus();
    render();
  }

  // Segue l'esecuzione di un campetto creata dopo "since" finché non termina, poi ricarica i risultati.
  // I due campetti si seguono in modo indipendente: la pagina mostra quello aperto.
  async function follow(area, since) {
    const c = courts[area];
    if (c.following) return; // la stiamo già seguendo
    c.following = true;
    if (c.phase !== "starting") resetLive(c, since); // dopo un clic è già stato azzerato in startRun
    c.live.since = since;
    const deadline = Date.now() + MAX_WAIT_MS;
    c.phase = "queued";
    render();

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      state.status = await loadStatus().catch(() => state.status);
      const st = courtStatus(area);
      const run = st && st.run;
      if (!run || new Date(run.createdAt).getTime() < since) continue; // GitHub non la mostra ancora
      collectShots(area, st);

      if (run.status === "completed") {
        c.phase = "refreshing";
        c.waiting = false;
        render();
        await refreshSummary(area, run);
        c.following = false;
        return;
      }
      c.phase = run.status === "in_progress" ? "in_progress" : "queued";
      // In coda dietro un'altra esecuzione dello stesso campetto (GitHub ne esegue una alla volta).
      c.waiting = c.phase === "queued" && (run.activeRuns || 1) > 1;
      render();
    }

    c.phase = "idle";
    c.following = false;
    c.waiting = false;
    c.messageKind = "warning";
    c.message = T.msgSlow;
    render();
  }

  // Il riepilogo contiene i risultati di un'esecuzione? (dell'ultima pubblicata, di un browser o della sicurezza:
  // con due campetti, un'altra partita può essere pubblicata subito dopo la nostra)
  function summaryHasRun(s, runId) {
    const urls = [s.runUrl, s.securityRun && s.securityRun.runUrl, ...Object.values(s.areaRuns || {}).map((r) => r && r.runUrl), ...Object.values(s.runs || {}).map((r) => r.runUrl)];
    return urls.some((u) => u && u.endsWith("/" + runId));
  }

  // Il riepilogo su GitHub Pages può arrivare qualche secondo dopo la fine dell'esecuzione.
  async function refreshSummary(area, run) {
    const c = courts[area];
    const runId = String(run.id);
    for (let i = 0; i < 12; i++) {
      const s = await loadSummary().catch(() => null);
      if (s && summaryHasRun(s, runId)) {
        state.summary = s;
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    // Lasciamo vedere la barra arrivare al 100% prima di mostrare i risultati
    // (se il campetto non è aperto, nessuno la sta guardando: niente attesa).
    c.live.target = 100;
    if (area === currentArea()) {
      await new Promise((resolve) => {
        const giveUp = Date.now() + 4000;
        const wait = () => (c.live.shown >= 99.5 || Date.now() > giveUp ? setTimeout(resolve, 700) : requestAnimationFrame(wait));
        wait();
      });
    }
    c.phase = "idle";
    c.justUpdated = true;
    c.messageKind = "info";
    c.message = run.conclusion === "success" ? T.msgDone : T.msgDoneKo;
    state.status = await loadStatus().catch(() => state.status);
    render();
  }

  /* ---------- Avvio ---------- */

  (async function init() {
    const [section, view] = detectDevice();
    setSection(section);
    state.lastFunctionalSection = section;
    state.view = view;
    const [summary, status] = await Promise.all([loadSummary().catch(() => null), loadStatus().catch(() => null)]);
    state.summary = summary;
    state.status = status;
    // Se non ci sono ancora risultati per i dispositivi emulati, si parte dalla sezione Computer.
    const grouped = groupByBrowser(summary);
    if (state.section === "mobile" && !(grouped && grouped.browsers && grouped.browsers.length)) {
      setSection("desktop");
      state.lastFunctionalSection = "desktop";
      state.view = "all";
    }
    // Link diretto a un campetto (es. /playground/#sicurezza, #seo, #marketing).
    const linkedCourt = courtFromLocation();
    if (linkedCourt) {
      setSection(linkedCourt);
      state.view = "all";
    }
    render();

    // Se su un campetto c'è già una partita quando la pagina si apre, la seguiamo.
    // Qualcun altro sta già giocando: lo diciamo e seguiamo la partita in diretta.
    function followIfBusy(area) {
      const c = courts[area];
      const st = courtStatus(area);
      if (c.following || c.phase !== "idle" || !st || !st.run || st.run.status === "completed") return false;
      c.message = T.courtBusy;
      c.messageKind = "info";
      follow(area, new Date(st.run.createdAt).getTime() - 1000);
      return true;
    }
    AREAS.forEach(followIfBusy);

    // Mentre la pagina è aperta controlliamo ogni 30 secondi (e quando si torna sulla scheda del browser):
    // se nel frattempo è partita un'esecuzione su un campetto, il suo pulsante si blocca e la pagina la segue.
    async function checkForNewRun() {
      if (document.visibilityState !== "visible") return;
      if (AREAS.every((area) => courts[area].following || courts[area].phase !== "idle")) return;
      const st = await loadStatus().catch(() => null);
      if (!st) return;
      state.status = st;
      const started = AREAS.map(followIfBusy).some(Boolean);
      if (!started) render(); // aggiorna i pulsanti (es. il conto alla rovescia "Libero tra N min")
    }
    setInterval(checkForNewRun, 30000);
    document.addEventListener("visibilitychange", checkForNewRun);
    // Link a un campetto aperto mentre la pagina è già caricata.
    window.addEventListener("hashchange", () => {
      const court = courtFromLocation();
      if (court && court !== currentArea()) openArea(court);
    });
  })();
})();
