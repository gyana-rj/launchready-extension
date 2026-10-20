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

E2E tests serve `tests/fixtures/` from a local static server (port 4173) and load `dist/` in Chromium. If Playwright's own browser isn't installed, point it at an existing Chromium:

```bash
CHROMIUM_PATH=/path/to/chrome npm run e2e
```

## Layout

```
src/audit/       pure audit engine (Document -> Issue[])
src/background/  service worker
src/popup/       popup UI
src/report/      full report page
src/config.ts    pricing and limits
public/          manifest.json
tests/unit/      Vitest tests
tests/e2e/       Playwright tests + static fixture server
tests/fixtures/  HTML fixtures
```
