import { chromium, expect, test as base, type BrowserContext, type Download, type Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const extensionPath = resolve("dist-e2e");

/** Test pages live on a fake domain that resolves to the local fixture server. */
export const SITE = "http://www.acme-plumbing.test:4173";
export const BLOCKED_SITE = "http://blocked.acme-plumbing.test:4173";

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // A fresh browser profile per test, so scan counts and storage start empty.
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "lr-")), {
      // Set CHROMIUM_PATH if Playwright's own browser download is unavailable.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--host-resolver-rules=MAP *.acme-plumbing.test 127.0.0.1",
        "--no-proxy-server",
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    await use(new URL(worker.url()).host);
  },
});

export { expect };

/** Opens the popup (as a tab) pointed at the tab showing `url`. */
export async function openPopupFor(context: BrowserContext, extensionId: string, url: string): Promise<Page> {
  const target = await context.newPage();
  await target.goto(url);

  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  const tabId = await popup.evaluate(async (wanted) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url === wanted)?.id;
  }, url);
  expect(tabId, `no tab found for ${url}`).toBeDefined();
  await popup.goto(`${popupUrl}?tab=${tabId}`);
  return popup;
}

/** Clicks "Scan this page" and waits for the result. */
export async function runScan(popup: Page): Promise<void> {
  await popup.getByRole("button", { name: "Scan this page" }).click();
  await expect(popup.locator("#results")).toBeVisible();
}

export const issueIds = (popup: Page) => popup.locator("[data-issue-id]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.issueId));

export const extensionPage = (extensionId: string, path: string) => `chrome-extension://${extensionId}/${path}`;

/** Activates Pro through the settings page, like a user would. */
export async function activatePro(context: BrowserContext, extensionId: string): Promise<void> {
  const settings = await context.newPage();
  await settings.goto(extensionPage(extensionId, "src/settings/settings.html"));
  await settings.locator("#key").fill("TEST-PRO");
  await settings.getByRole("button", { name: "Activate" }).click();
  await expect(settings.locator("#plan")).toHaveText("Pro plan active");
  await settings.close();
}

/** Contents of a downloaded file. */
export async function readDownload(download: Download): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
