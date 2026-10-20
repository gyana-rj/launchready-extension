# LaunchReady (placeholder name)

Chrome extension (Manifest V3): a pre-launch website checker for freelance web developers and small agencies. It scans the current page, finds launch mistakes, explains how to fix each one, and lets Pro users export a branded client report.

## Tech rules
- Manifest V3, plain TypeScript, Vite build. No React unless truly needed; keep the bundle small.
- All analysis runs locally in the browser. No backend, no analytics, no remote code.
- Minimal permissions: `activeTab`, `storage`, `scripting`. Ask for host permissions only when needed (bulk scan, link checking) via optional permissions.
- The audit engine must be pure functions that take a `Document` (plus optional response headers and robots.txt text) and return a list of issues. This makes it testable with jsdom.
- Each issue: `{ id, severity: "critical" | "warning" | "info", title, description, howToFix, elements }` where `severity` is `"critical" | "warning" | "info"` and `elements` is CSS selectors or snippets, max 10.

## Checks (v1)
**Critical**
- meta robots noindex or X-Robots-Tag noindex
- robots.txt with `Disallow: /` for all agents
- canonical pointing to a different host, localhost, or staging-looking domain (`staging.`, `dev.`, `test.`, `*.vercel.app`, `*.netlify.app`, `*.pages.dev`)
- mixed content (http resources on https page)
- missing `<title>`

**Warning**
- missing or too long/short meta description
- missing H1 or multiple H1s
- skipped heading levels
- images missing alt
- missing og:title, og:description, og:image
- og:url or og:image pointing to staging/localhost
- lorem ipsum or common placeholder text
- missing favicon
- missing viewport meta
- missing html lang
- links with `href="#"` or empty href
- broken same-origin links (check up to 50 with HEAD requests, fall back to GET)

**Info**
- page word count, number of links, number of images

## Features
**Free**: scan current page, issue list grouped by severity, how-to-fix text, 5 scans per day (counted locally).

**Pro**:
- unlimited scans
- audit history (`chrome.storage.local`, last 200 audits)
- CSV export
- branded report page with logo upload, agency name, client name, and date; prints cleanly to PDF via a print stylesheet
- bulk scan of up to 50 pasted URLs (fetch HTML and parse with `DOMParser`; note in the UI that JavaScript-rendered content is not included)

**Licensing**: all Pro checks go behind a single license module (`src/license.ts`) with an interface like `isPro()` and `activate(key)`. For now, a stub that accepts the key `"TEST-PRO"` so everything is testable. Payment provider will be wired in later.

Pricing values live in `src/config.ts`.

## UI
Popup: "Scan this page" button, score out of 100, issue counts per severity, expandable issue list, button to open the full report in a new tab. Clean, professional design, light and dark mode.

## Testing
- Unit tests with Vitest + jsdom: one HTML fixture per check (a "bad" page that triggers it and a "good" page that does not).
- End-to-end tests with Playwright loading the built unpacked extension in Chromium, against a local static server serving the fixtures. Test: scan finds expected issues, free limit blocks the 6th scan, TEST-PRO unlocks Pro, CSV export downloads, report page renders.
- `npm test` runs unit tests, `npm run e2e` runs Playwright. Both must pass before a phase counts as done.

## Phases
1. Project setup: Vite + TypeScript + manifest, folder structure, Vitest and Playwright configured with one passing sample test each, README with how to build and load the extension.
2. Audit engine: all checks as pure functions with unit tests and fixtures.
3. Popup UI + scanning the current tab + free daily limit + e2e tests.
4. Pro features: license stub, history, CSV export, branded report page, bulk scan, e2e tests.
5. Polish: error handling, empty states, icons, Chrome Web Store listing text, a privacy policy page (states no data leaves the browser), and a final full test run.

## Working rules
- Work on one phase per session. At the end of each phase, run all tests, fix failures, update the "Progress" section below, and commit.
- Keep code simple and readable. Don't add features outside this spec.

## Progress
- [x] Phase 1: Project setup (Vite 8 + TS, MV3 manifest, Vitest + Playwright sample tests, README). Note: in sandboxes run e2e with `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- [x] Phase 2: Audit engine — all spec checks in `src/engine/checks/{critical,warnings,info}.ts`; `runAudit(doc, ctx)` returns `{ issues, score }` (score = 100 − 15 per critical − 5 per warning, min 0, info free; weights in `src/engine/score.ts`). Broken-link check is pure over `ctx.linkResults`; the network part (`getSameOriginLinks`, `checkLinks`: HEAD then GET fallback) is in `src/engine/linkChecker.ts` for Phase 3 to call. Fixtures: `tests/fixtures/<check>.bad.html` / `.good.html` (generated from one baseline page; `good.html` is the all-passing baseline). 71 unit tests.
- [x] Phase 3: Popup UI + scanning + free limit + e2e — popup (`src/popup/`) injects `content.js` (IIFE built by `vite.content.config.ts` from `src/content/scan.ts`) into the tab via `scripting.executeScript`; the content script runs the engine in the page and fetches page headers (HEAD, GET fallback), `/robots.txt` and same-origin links itself (same-origin, so no host permission needed). Free limit: `src/limits.ts` (5/day, local date, `chrome.storage.local` key `scanUsage`, counted only after a successful scan). Last scan is saved (`src/store.ts`) and shown by a basic `report.html`; Phase 4 builds the branded report on it. Shared rendering/theme in `src/ui/` (text via textContent only). E2E uses `npm run build:e2e` → `dist-e2e/` (adds host permission for fake `*.acme-plumbing.test`, mapped to the local fixture server; popup opened as a tab with `?tab=<id>`). 81 unit tests, 20 e2e tests.
- [ ] Phase 4: Pro features
- [ ] Phase 5: Polish
