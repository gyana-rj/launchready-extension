import { chromium, expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve("dist");

test("extension loads and its popup page opens", async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "lr-")), {
    // Set CHROMIUM_PATH if Playwright's own browser download is unavailable.
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(worker.url()).host;

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await expect(popup.locator("#status")).toHaveText("LaunchReady is loaded.");
  } finally {
    await context.close();
  }
});
