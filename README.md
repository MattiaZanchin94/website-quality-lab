# Website Quality Lab

[![E2E tests](https://github.com/MattiaZanchin94/website-quality-lab/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/MattiaZanchin94/website-quality-lab/actions/workflows/e2e-tests.yml)
[![Release](https://img.shields.io/github/v/release/MattiaZanchin94/website-quality-lab)](https://github.com/MattiaZanchin94/website-quality-lab/releases/latest)
[![Live results](https://img.shields.io/badge/live%20results-Playground-1d4ed8)](https://mattiazanchin.com/playground/)

🇮🇹 [Leggi in italiano](README.it.md)

End-to-end test suite that continuously checks my website, [mattiazanchin.com](https://mattiazanchin.com), on four desktop browsers and five emulated phones and tablets, and publishes the results on the site itself.

On the **[Playground](https://mattiazanchin.com/playground/)** page anyone can see the latest results in plain language and **start a new test run**. The page recognises the visitor's device: from a computer it opens the desktop browsers, from an iPhone, an Android phone or an iPad it opens and runs that emulated device. The page is available in Italian and English.

---

## How it works

```mermaid
flowchart LR
    V["Visitor<br/>Playground page"] -- "Run checks" --> WP["WordPress plugin<br/>REST proxy + cooldown"]
    WP -- "workflow_dispatch" --> GA
    S["Schedule (hourly)<br/>push to main"] --> GA
    subgraph GA["GitHub Actions"]
        direction TB
        T1["Tests · Chromium"] & T4["Tests · Edge"] & T2["Tests · Firefox"] & T3["Tests · WebKit"] & T5["Tests · iPhone, Android, iPad portrait/landscape,<br/>Galaxy Fold (emulated)"] --> P["Publish<br/>summary.json"]
    end
    P -- "summary.json" --> GP["GitHub Pages"]
    GP -- "fetch" --> V
    T1 & T4 & T2 & T3 & T5 -. "Playwright" .-> SITE["mattiazanchin.com"]
```

1. **Playwright + NUnit** tests (C#) open the real site and act like a user: open pages, click menu items, read articles.
2. **GitHub Actions** runs them every hour, on every push, and on demand, on **Chromium (Chrome), Microsoft Edge, Firefox and WebKit (Safari)**, plus **iPhone, Android, iPad in portrait and landscape and a folded Galaxy Z Fold**, emulated with Playwright device profiles (screen size, touch, user agent), all in parallel. On demand runs can target the desktop browsers, the devices, or a single one of them.
3. A publish job merges the results of the browsers and deploys a compact `summary.json` to **GitHub Pages**.
4. A small **WordPress plugin** shows that summary on the Playground page and lets visitors start a run, through a server-side proxy that keeps the GitHub token private and allows at most one run every 10 minutes.

## Parallel execution

Parallelism works on two levels; this project currently uses the first one.

| Level | Where | Status |
|---|---|---|
| **1. Across machines** | GitHub Actions starts one job per browser or device (`strategy.matrix`): nine isolated machines that run at the same time | ✅ in use |
| **2. Within a run** | NUnit runs several tests at the same time on one machine (`[Parallelizable]`, `[LevelOfParallelism]`) | next step |

On each machine the tests run **sequentially**, so a run lasts as long as the **slowest machine**, not the sum of all of them. The Playground page shows this as a duration chart per browser (Desktop section) or per device (Phones and tablets section), next to the **total time on GitHub**, which also includes preparing the machines and publishing the results.

Level 2 needs tests that share no state and don't depend on each other's order. These tests already qualify (they only read the site), but running many of them at once against the live site also has to account for the hosting provider's anti-bot protection.

## What is tested

Each check runs on every browser and device (13 checks × 9 = 117 runs). On phones and tablets the navigation tests open the site's mobile menu first, like a person would, when the site shows it (an iPad in landscape gets the desktop menu).

| Type | Area | Check | Priority |
|---|---|---|---|
| Smoke | Availability | The site is reachable and loads correctly | Blocker |
| Smoke | Navigation | Each main menu item opens the right page (6 items, in menu order) | Blocker |
| Regression | Playground | Visitors can start a run (the button is available) | Blocker |
| Regression | Playground | The Playground page shows up-to-date results | Blocker |
| Regression | Technical articles | The latest article opens with matching title and content | Major |
| Regression | Playground | The Playground page is also available in English | Major |
| Regression | Playground | Results can be viewed for a single browser | Major |
| Regression | Playground | Checks can be filtered by priority | Major |

**Smoke** checks cover the essentials and are the first to flag a problem; **regression** checks go deeper into single features. Both are NUnit categories, so they can be run separately.

**Blocker** means that if the check fails, the site or one of its main functions can't be used; **Major** means important, but a failure doesn't block the site. Allure has no "major" level, so Major is Allure's `normal` severity, displayed as Major on the Playground page.

## Tech stack

| | |
|---|---|
| Language | C# · .NET 10 |
| Browser automation | Playwright for .NET |
| Test framework | NUnit 4 |
| Reporting | GitHub Actions job summary |
| CI/CD | GitHub Actions (browser and device matrix in the official Playwright container, scheduled and on-demand runs) |
| Hosting of results | GitHub Pages |
| Website integration | WordPress plugin (PHP, REST API, vanilla JS) |

## Project structure

```
.
├── .github/workflows/e2e-tests.yml   # CI: browser matrix + publish job
├── Tests/
│   ├── QualityLabTest.cs             # base class: shared setup, browser tagging
│   ├── WebsiteAvailabilityTests.cs   # smoke
│   ├── NavigationTests.cs            # smoke, data-driven from the menu definition
│   ├── ArticleTests.cs               # regression
│   └── PlaygroundTests.cs            # regression: the page that shows these results
├── scripts/summary.mjs               # test results → summary.json for the website
├── wordpress/quality-lab-playground/ # WordPress plugin (shortcode + REST proxy)
└── QualityLab.csproj
```

## Run locally

Requirements: [.NET 10 SDK](https://dotnet.microsoft.com/download).

```bash
# Build and install the browsers (first time only)
dotnet build
pwsh bin/Debug/net10.0/playwright.ps1 install chromium firefox webkit

# Run all tests (Chromium by default)
dotnet test

# Choose the browser
BROWSER=webkit dotnet test

# Emulated devices: iphone, android, fold, ipad, ipadland (WebKit for iPhone/iPad, Chromium for Android/Fold)
QLP_DEVICE=iphone BROWSER=webkit dotnet test

# Microsoft Edge (Chromium with the msedge channel; Edge must be installed)
dotnet test -- Playwright.LaunchOptions.Channel=msedge

# Run only the smoke checks
dotnet test --filter TestCategory=Smoke
```

## Design notes

- **Plain-language results.** Test names are written for non-technical readers, so the website shows sentences like “The site is reachable and loads correctly” instead of method names.
- **The Playground follows the visitor's device.** Two sections, *Desktop* and *Phones and tablets*, each with its own results, duration chart and run button, so the "slowest" always refers to the machines of that section. The page opens the section and tab of the visitor's device (iPhone, Android, iPad, also when iPadOS presents itself as a Mac) and the run button checks only that device; tabs let anyone look at the others. The folded Galaxy Fold runs only in the automatic runs.
- **Reliable CI.** The tests run in the official Playwright container, which already ships the browsers and their system dependencies: only Microsoft Edge is installed during the run, with timeouts and retries.
- **Live progress.** During a run each test reports *started / passed / failed* to the WordPress plugin (`Tests/LiveProgress.cs`, authenticated with a shared secret). The Playground shows which check is running on which browser and a progress bar that moves continuously but never runs ahead of the real progress or goes backwards. Reporting is fire-and-forget: if it fails, the tests are unaffected.
- **Order from data, not markup.** The Playground page lists checks by priority (smoke first, then severity, then menu position), computed from test metadata in `summary.json`.
- **One source of truth for the menu.** Navigation tests are generated with `[TestCaseSource]` from a single ordered array: updating the menu means editing one line.
- **Security of the run button.** The GitHub token lives only in `wp-config.php`; the browser talks to WordPress, never to GitHub. A global cooldown and a check for runs already in progress prevent abuse.
- **Bot protection is not a site failure.** If the hosting provider's anti-bot protection shows a CAPTCHA to the test browser, the check is marked *not verifiable* (`Assert.Ignore`, with the reason) instead of failed. Tests never try to get past a CAPTCHA.
- **The checks never trigger themselves.** The Playground test verifies that the run button exists but never clicks it, otherwise every hourly run would start another one.

## Author

**Mattia Zanchin** · Software Tester · [mattiazanchin.com](https://mattiazanchin.com)
