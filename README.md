# LaunchReady

Chrome extension (Manifest V3) that scans a web page for pre-launch mistakes and explains how to fix them. All analysis runs locally in the browser; no backend, no analytics. See `CLAUDE.md` for the full spec and phase plan.

## Develop

```bash
npm install
npm run build      # type-checks, then builds the unpacked extension into dist/
npm run dev        # rebuild on change
```

## Load the extension in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin LaunchReady and click its icon.

## Tests

```bash
npm test           # Vitest + jsdom unit tests (tests/unit)
npm run e2e        # builds, then runs Playwright against the unpacked extension (tests/e2e)
```

E2E tests load a separate test build (`dist-e2e/`, made by `npm run build:e2e`, which `npm run e2e` runs for you). It differs from `dist/` only by a host permission for the fake domain `*.acme-plumbing.test`, so the tests can scan pages without clicking the toolbar icon. Chromium maps that domain to a local static server (port 4173) that serves `tests/fixtures/`. In the tests the popup opens as a normal tab, and `?tab=<id>` tells it which tab to scan.

If Playwright's own browser isn't installed, point it at an existing Chromium:

```bash
CHROMIUM_PATH=/path/to/chrome npm run e2e
```

## Layout

```
src/engine/      pure audit engine (Document -> issues + score)
src/background/  service worker
src/popup/       popup UI
src/content/     script injected into the scanned tab (runs the engine)
src/ui/          shared rendering + theme (popup and report)
src/limits.ts    free daily scan limit
src/report/      full report page
src/config.ts    pricing and limits
public/          manifest.json
tests/unit/      Vitest tests
tests/e2e/       Playwright tests + static fixture server
tests/fixtures/  HTML fixtures
```
