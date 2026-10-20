import type { BrowserContext, Page } from "@playwright/test";
import { activatePro, expect, extensionPage, openPopupFor, readDownload, runScan, SITE, test } from "./fixtures";

const POPUP = "src/popup/popup.html";

/** Opens `url` in a new tab and returns the id of that tab (found by diffing tab ids, since the URL may be hidden from the extension). */
async function openTabAndGetId(context: BrowserContext, extensionId: string, url: string): Promise<{ popup: Page; tabId: number }> {
  const popup = await context.newPage();
  await popup.goto(extensionPage(extensionId, POPUP));
  const idsBefore = await popup.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.id));
  const target = await context.newPage();
  await target.goto(url).catch(() => undefined); // some pages (chrome://, routed pages) don't finish loading the usual way
  const tabId = await popup.evaluate(
    async (before) => (await chrome.tabs.query({})).map((t) => t.id).find((id) => !before.includes(id)),
    idsBefore,
  );
  expect(tabId).toBeDefined();
  await popup.goto(`${extensionPage(extensionId, POPUP)}?tab=${tabId}`);
  return { popup, tabId: tabId as number };
}

const scanButton = (popup: Page) => popup.getByRole("button", { name: "Scan this page" });

test.describe("pages that can't be scanned", () => {
  test("chrome:// pages get a friendly message and don't use a scan", async ({ context, extensionId }) => {
    const { popup } = await openTabAndGetId(context, extensionId, "chrome://version");
    await scanButton(popup).click();
    await expect(popup.locator("#message")).toContainText("Browser pages (like chrome:// pages and the new tab page) can't be scanned");
    await expect(popup.locator("#message")).not.toContainText("Cannot access");
    await expect(popup.locator("#results")).toBeHidden();
    await expect(popup.locator("#usage")).toHaveText("5 of 5 free scans left today");
    await expect(scanButton(popup)).toBeEnabled();
  });

  test("PDFs get a friendly message without trying to inject", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/sample.pdf`);
    await scanButton(popup).click();
    await expect(popup.locator("#message")).toContainText("PDF files can't be scanned");
    await expect(popup.locator("#results")).toBeHidden();
    await expect(popup.locator("#usage")).toHaveText("5 of 5 free scans left today");
  });

  test("an error clears the previous result instead of leaving it on screen", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await runScan(popup);
    await expect(popup.locator("#results")).toBeVisible();

    // Point the next scan at the popup's own tab, which can't be scripted (no reload, so the old result is still on screen).
    await popup.evaluate(async () => {
      const own = await chrome.tabs.getCurrent();
      history.replaceState(null, "", `?tab=${own?.id}`);
    });
    await scanButton(popup).click();
    await expect(popup.locator("#message")).toContainText("can't be scanned");
    await expect(popup.locator("#results")).toBeHidden();
  });

  test("a failed robots.txt fetch is noted but the scan still completes", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, "http://flaky.acme-plumbing.test:4173/good.html");
    await runScan(popup);
    await expect(popup.locator("#skipped")).toBeVisible();
    await expect(popup.locator("#skipped")).toContainText("robots.txt couldn't be fetched, so the robots.txt check was skipped.");
    await expect(popup.locator("#score")).toHaveText("100/100");

    // The report shows the same note.
    const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
    await report.waitForLoadState();
    await expect(report.locator("#skipped")).toContainText("robots.txt couldn't be fetched");
  });

  test("a normal page has no 'skipped' note", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await runScan(popup);
    await expect(popup.locator("#skipped")).toBeHidden();
  });

  test("if browser storage is full, the results are still shown with an explanation", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
    await popup.evaluate(() => {
      chrome.storage.local.set = () => Promise.reject(new Error("QUOTA_BYTES quota exceeded"));
    });
    await runScan(popup);
    await expect(popup.locator("#score")).toHaveText("85/100");
    await expect(popup.locator("#message")).toContainText("couldn't be saved");
    await expect(popup.locator("#message")).not.toContainText("QUOTA");
  });

  test("bulk scan explains each kind of failure", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, "src/bulk/bulk.html"));
    await bulk.locator("#urls").fill([`${SITE}/missing.html`, "http://www.acme-plumbing.test:4999/", `${SITE}/good.html`].join("\n"));
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();
    await expect(bulk.locator("#progress")).toHaveText("Done: 1 of 3 scanned.");
    await expect(bulk.locator(".bulk-row").nth(0)).toContainText("Failed: Page not found (HTTP 404)");
    await expect(bulk.locator(".bulk-row").nth(1)).toContainText("Failed: Could not load the page (unreachable, or it blocked the request)");
    await expect(bulk.locator(".bulk-row").nth(2)).toContainText("Scanned");
  });
});

test.describe("loading and empty states", () => {
  test("popup explains what to do before the first scan", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await expect(popup.locator("#hint")).toBeVisible();
    await expect(popup.locator("#hint")).toContainText("click “Scan this page”");
    await expect(popup.locator("#loading")).toBeHidden();
    await runScan(popup);
    await expect(popup.locator("#hint")).toBeHidden();
  });

  test("popup shows a loading state while scanning", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/slow.html`); // has a link that takes 1.5 s to answer
    await scanButton(popup).click();

    await expect(popup.locator("#loading")).toBeVisible();
    await expect(popup.locator("#loading")).toContainText("Checking the page");
    await expect(popup.getByRole("button", { name: "Scanning…" })).toBeDisabled();
    await expect(popup.locator("#results")).toBeHidden();

    await expect(popup.locator("#results")).toBeVisible();
    await expect(popup.locator("#loading")).toBeHidden();
    await expect(scanButton(popup)).toBeEnabled();
  });

  test("history and bulk scan have empty states for Pro users", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, "src/history/history.html"));
    await expect(history.locator("#empty")).toContainText("No audits yet");
    await expect(history.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    await expect(history.getByRole("button", { name: "Clear history" })).toBeDisabled();
    await expect(history.locator("#loading")).toBeHidden();

    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, "src/bulk/bulk.html"));
    await expect(bulk.locator("#empty")).toBeVisible();
    await expect(bulk.locator("#bar")).toBeHidden();
  });

  test("bulk scan shows progress while running", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, "src/bulk/bulk.html"));
    await bulk.locator("#urls").fill(`${SITE}/slow`); // 1.5 s response
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();
    await expect(bulk.locator("#bar")).toBeVisible();
    await expect(bulk.locator("#progress")).toHaveText("Scanned 0 of 1");
    await expect(bulk.getByRole("button", { name: "Start bulk scan" })).toBeDisabled();
    await expect(bulk.locator("#progress")).toHaveText("Done: 0 of 1 scanned."); // /slow isn't HTML
    await expect(bulk.locator("#bar")).toBeHidden();
    await expect(bulk.getByRole("button", { name: "Start bulk scan" })).toBeEnabled();
  });

  test("report shows its empty state, and explains when a saved audit is gone", async ({ context, extensionId }) => {
    const report = await context.newPage();
    await report.goto(extensionPage(extensionId, "src/report/report.html?id=missing"));
    await expect(report.locator("#empty")).toBeVisible();
    await expect(report.locator("#loading")).toBeHidden();

    await runScan(await openPopupFor(context, extensionId, `${SITE}/good.html`));
    await report.reload();
    await expect(report.locator("#fallback-note")).toContainText("no longer in your history");
    await expect(report.locator("#score")).toHaveText("100/100");
  });
});

test.describe("icons and privacy", () => {
  test("icons exist in every required size and are used by the extension", async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(extensionPage(extensionId, "src/settings/settings.html"));
    const manifest = await page.evaluate(() => chrome.runtime.getManifest());
    expect(Object.keys(manifest.icons ?? {})).toEqual(["16", "32", "48", "128"]);
    expect(Object.keys(manifest.action?.default_icon ?? {})).toEqual(["16", "32", "48", "128"]);

    for (const size of [16, 32, 48, 128]) {
      await page.goto(extensionPage(extensionId, `icons/icon-${size}.png`));
      expect(await page.locator("img").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([size, size]);
    }

    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    expect(await popup.locator(".brand img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(32);
  });

  test("privacy policy is reachable and says no data leaves the browser", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    const [privacy] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Privacy" }).click()]);
    await privacy.waitForLoadState();
    expect(privacy.url()).toBe(extensionPage(extensionId, "src/privacy/privacy.html"));
    await expect(privacy.locator("h1")).toHaveText("LaunchReady privacy policy");
    await expect(privacy.locator("#summary")).toContainText("No data leaves your browser");

    const settings = await context.newPage();
    await settings.goto(extensionPage(extensionId, "src/settings/settings.html"));
    await expect(settings.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", extensionPage(extensionId, "src/privacy/privacy.html"));
  });

  test("the popup has a Send feedback link, and the policy has the contact email", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await expect(popup.getByRole("link", { name: "Send feedback" })).toHaveAttribute(
      "href",
      "mailto:devgyanaranjan@gmail.com?subject=LaunchReady%20feedback",
    );
    const privacy = await context.newPage();
    await privacy.goto(extensionPage(extensionId, "src/privacy/privacy.html"));
    await expect(privacy.getByRole("link", { name: "devgyanaranjan@gmail.com" })).toBeVisible();
  });

  test("no data leaves the browser: the only network requests are to the scanned sites", async ({ context, extensionId }) => {
    const requested: string[] = [];
    context.on("request", (request) => requested.push(request.url()));

    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
    await runScan(popup);
    const [csv] = await Promise.all([popup.waitForEvent("download"), popup.getByRole("button", { name: "Export CSV" }).click()]);
    await readDownload(csv);
    const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
    await report.waitForLoadState();
    for (const page of ["src/history/history.html", "src/settings/settings.html", "src/privacy/privacy.html"]) {
      await (await context.newPage()).goto(extensionPage(extensionId, page));
    }
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, "src/bulk/bulk.html"));
    await bulk.locator("#urls").fill(`${SITE}/good.html\n${SITE}/noindex.bad.html`);
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();
    await expect(bulk.locator("#progress")).toHaveText("Done: 2 of 2 scanned.");

    const external = requested.filter((url) => /^https?:/.test(url) && !new URL(url).hostname.endsWith(".acme-plumbing.test"));
    expect(external).toEqual([]);
    expect(requested.some((url) => url.startsWith(SITE))).toBe(true); // sanity: we did capture the scans
  });
});
