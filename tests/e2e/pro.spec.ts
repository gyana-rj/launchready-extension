import { activatePro, BLOCKED_SITE, expect, extensionPage, openPopupFor, readDownload, runScan, SITE, test } from "./fixtures";

const SETTINGS = "src/settings/settings.html";
const HISTORY = "src/history/history.html";
const BULK = "src/bulk/bulk.html";
const REPORT = "src/report/report.html";

// 1x1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test.describe("license", () => {
  test("free users see Pro features with an Upgrade to Pro prompt", async ({ context, extensionId }) => {
    const settings = await context.newPage();
    await settings.goto(extensionPage(extensionId, SETTINGS));
    await expect(settings.locator("#plan")).toHaveText("Free plan");
    await expect(settings.locator("#pricing")).toContainText("$9/month");

    for (const [path, feature] of [[HISTORY, "Audit history"], [BULK, "Bulk scan"]]) {
      const page = await context.newPage();
      await page.goto(extensionPage(extensionId, path));
      await expect(page.locator(".upgrade")).toContainText(`${feature} is a Pro feature`);
      await expect(page.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", extensionPage(extensionId, SETTINGS));
      await expect(page.locator("#content")).toBeHidden();
    }
  });

  test("a wrong key is rejected, TEST-PRO unlocks Pro and it persists", async ({ context, extensionId }) => {
    const settings = await context.newPage();
    await settings.goto(extensionPage(extensionId, SETTINGS));

    await settings.locator("#key").fill("WRONG-KEY");
    await settings.getByRole("button", { name: "Activate" }).click();
    await expect(settings.locator("#license-message")).toContainText("isn't valid");
    await expect(settings.locator("#plan")).toHaveText("Free plan");

    await settings.locator("#key").fill("TEST-PRO");
    await settings.getByRole("button", { name: "Activate" }).click();
    await expect(settings.locator("#plan")).toHaveText("Pro plan active");

    await settings.reload();
    await expect(settings.locator("#plan")).toHaveText("Pro plan active");

    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, HISTORY));
    await expect(history.locator("#content")).toBeVisible();
    await expect(history.locator(".upgrade")).toHaveCount(0);

    await settings.getByRole("button", { name: "Remove license from this browser" }).click();
    await expect(settings.locator("#plan")).toHaveText("Free plan");
  });

  test("Pro lifts the daily scan limit", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await popup.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return chrome.storage.local.set({ scanUsage: { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, count: 5 } });
    });
    await popup.reload();
    await expect(popup.getByRole("button", { name: "Scan this page" })).toBeDisabled();
    await expect(popup.getByRole("button", { name: "Upgrade to Pro" })).toBeVisible();

    await activatePro(context, extensionId);
    await popup.reload();
    await expect(popup.locator("#pro-badge")).toBeVisible();
    await expect(popup.locator("#usage")).toHaveText("Unlimited scans");
    await expect(popup.getByRole("button", { name: "Scan this page" })).toBeEnabled();
    await runScan(popup);
    await expect(popup.locator("#score")).toHaveText("100/100");
  });
});

test.describe("history", () => {
  test("saves each audit, newest first, and opens its report", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    for (const page of ["good.html", "noindex.bad.html"]) {
      const popup = await openPopupFor(context, extensionId, `${SITE}/${page}`);
      await runScan(popup);
    }

    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, HISTORY));
    const rows = history.locator(".audit-row");
    await expect(rows).toHaveCount(2);
    await expect(history.locator("#count")).toHaveText("2 of 200 audits stored");
    await expect(rows.nth(0)).toContainText(`${SITE}/noindex.bad.html`);
    await expect(rows.nth(0)).toContainText("85");
    await expect(rows.nth(1)).toContainText(`${SITE}/good.html`);

    await rows.nth(1).getByRole("link", { name: "View report" }).click();
    await expect(history.locator("#page")).toContainText(`${SITE}/good.html`);
    await expect(history.locator("#score")).toHaveText("100/100");
  });

  test("keeps only the last 200 audits", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await popup.evaluate(() =>
      chrome.storage.local.set({
        history: Array.from({ length: 200 }, (_, i) => ({ id: `old-${i}`, url: `https://old.example/${i}`, title: "", scannedAt: i, score: 90, issues: [] })),
      }),
    );
    await runScan(popup);

    const history = await popup.evaluate(async () => (await chrome.storage.local.get("history")).history as { url: string }[]);
    expect(history).toHaveLength(200);
    expect(history[0].url).toBe(`${SITE}/good.html`);
    expect(history.at(-1)?.url).toBe("https://old.example/198"); // old-199, the oldest, was dropped
  });

  test("free scans are not saved, and history can be cleared", async ({ context, extensionId }) => {
    const free = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await runScan(free);
    expect(await free.evaluate(async () => (await chrome.storage.local.get("history")).history)).toBeUndefined();

    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await runScan(popup);
    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, HISTORY));
    await expect(history.locator(".audit-row")).toHaveCount(1);

    history.once("dialog", (dialog) => void dialog.accept());
    await history.getByRole("button", { name: "Clear history" }).click();
    await expect(history.locator("#empty")).toBeVisible();
    await expect(history.locator(".audit-row")).toHaveCount(0);
  });
});

test.describe("CSV export", () => {
  test("downloads the current scan as CSV", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
    await runScan(popup);

    const [download] = await Promise.all([popup.waitForEvent("download"), popup.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^launchready-www\.acme-plumbing\.test-\d{4}-\d{2}-\d{2}\.csv$/);

    const csv = await readDownload(download);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Scanned at,URL,Score,Severity,Issue ID,Issue,Description,How to fix,Elements");
    expect(lines).toHaveLength(3); // header + noindex + page-stats
    expect(lines[1]).toContain(`${SITE}/noindex.bad.html,85,critical,noindex,Page is blocked from search engines`);
  });

  test("history exports every saved audit", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    for (const page of ["good.html", "noindex.bad.html"]) await runScan(await openPopupFor(context, extensionId, `${SITE}/${page}`));

    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, HISTORY));
    const [download] = await Promise.all([history.waitForEvent("download"), history.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^launchready-audits-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await readDownload(download)).replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(1 + 1 + 2); // header + page-stats (good) + noindex + page-stats (bad)
  });

  test("free users get an upgrade prompt instead of a download", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
    await runScan(popup);
    await expect(popup.getByRole("button", { name: "Export CSV (Pro)" })).toBeVisible();

    let downloaded = false;
    popup.on("download", () => (downloaded = true));
    await popup.getByRole("button", { name: "Export CSV (Pro)" }).click();
    await expect(popup.locator("#message")).toContainText("CSV export is a Pro feature");
    await expect(popup.getByRole("button", { name: "Upgrade to Pro" })).toBeVisible();
    await popup.waitForTimeout(300);
    expect(downloaded).toBe(false);
  });
});

test.describe("branded report", () => {
  test("renders with agency, client, date and logo, and keeps them", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
    await runScan(popup);
    const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
    await report.waitForLoadState();

    await expect(report.locator("#branding-panel")).toBeVisible();
    await expect(report.locator("#agency")).toBeHidden();
    await report.getByLabel("Agency name").fill("Pixel & Co");
    await report.getByLabel("Client name").fill("Acme Plumbing");
    await report.getByLabel("Report date").fill("2026-03-14");
    await report.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });

    await expect(report.locator("#agency")).toHaveText("Pixel & Co");
    await expect(report.locator("#client")).toHaveText("Acme Plumbing");
    await expect(report.locator("#report-date")).toHaveText("March 14, 2026");
    await expect(report.locator("#page")).toContainText(`${SITE}/noindex.bad.html`);
    await expect(report.locator("#logo")).toBeVisible();
    expect(await report.locator("#logo").evaluate((img: HTMLImageElement) => img.src.startsWith("data:image/png") && img.naturalWidth)).toBe(1);
    await expect(report.locator("#score")).toHaveText("85/100");
    await expect(report.locator('[data-issue-id="noindex"] .how-to-fix')).toBeVisible(); // issues are expanded in the report

    // Branding is remembered.
    await report.reload();
    await expect(report.locator("#agency")).toHaveText("Pixel & Co");
    await expect(report.locator("#client")).toHaveText("Acme Plumbing");
    await expect(report.locator("#logo")).toBeVisible();

    await report.getByRole("button", { name: "Remove logo" }).click();
    await expect(report.locator("#logo")).toBeHidden();
  });

  test("rejects logos that are too large", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    await runScan(await openPopupFor(context, extensionId, `${SITE}/good.html`));
    const report = await context.newPage();
    await report.goto(extensionPage(extensionId, REPORT));
    await report.getByLabel("Logo").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(1_200_000) });
    await expect(report.locator("#logo-error")).toContainText("over 1 MB");
    await expect(report.locator("#logo")).toBeHidden();
  });

  test("prints cleanly: no controls, always light, and saves as PDF", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    await runScan(await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`));
    const report = await context.newPage();
    await report.goto(extensionPage(extensionId, REPORT));
    await report.getByLabel("Agency name").fill("Pixel & Co");

    await report.emulateMedia({ media: "print", colorScheme: "dark" });
    await expect(report.locator("#branding-panel")).toBeHidden();
    await expect(report.locator(".nav")).toBeHidden();
    await expect(report.getByRole("button", { name: "Print / Save as PDF" })).toBeHidden();
    await expect(report.locator("#agency")).toBeVisible();
    await expect(report.locator("#report")).toBeVisible();
    expect(await report.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");

    const pdf = await report.pdf();
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);
  });

  test("free users get the plain report and an upgrade prompt for branding", async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
    await runScan(popup);
    const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
    await report.waitForLoadState();

    await expect(report.locator("#score")).toHaveText("85/100");
    await expect(report.locator("#branding-locked")).toContainText("is a Pro feature");
    await expect(report.locator("#branding-panel")).toBeHidden();
    await expect(report.locator("#agency")).toBeHidden();
  });
});

test.describe("bulk scan", () => {
  test("scans pasted URLs and reports results, failures and skipped lines", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, BULK));

    await expect(bulk.locator("#js-note")).toContainText("JavaScript-rendered content is not included");
    await bulk.locator("#urls").fill([`${SITE}/good.html`, `${SITE}/noindex.bad.html`, `${SITE}/does-not-exist.html`, "not a url", `${SITE}/good.html`].join("\n"));
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();

    await expect(bulk.locator("#progress")).toHaveText("Done: 2 of 3 scanned.");
    await expect(bulk.locator("#notice")).toContainText("Skipped 1 line(s)");
    const rows = bulk.locator(".bulk-row");
    await expect(rows).toHaveCount(3); // the duplicate was dropped
    await expect(rows.nth(0)).toContainText("100");
    await expect(rows.nth(0)).toContainText("Scanned");
    await expect(rows.nth(1)).toContainText("85");
    await expect(rows.nth(2)).toContainText("Failed: HTTP 404");

    // Results are saved to history and can be exported.
    const history = await context.newPage();
    await history.goto(extensionPage(extensionId, HISTORY));
    await expect(history.locator(".audit-row")).toHaveCount(2);

    const [download] = await Promise.all([bulk.waitForEvent("download"), bulk.getByRole("button", { name: "Export CSV" }).click()]);
    expect((await readDownload(download)).replace("﻿", "").trim().split("\r\n")).toHaveLength(1 + 1 + 2); // header + good (page-stats) + noindex page (noindex, page-stats)
  });

  test("uses each site's own robots.txt", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, BULK));
    await bulk.locator("#urls").fill(`${BLOCKED_SITE}/good.html`);
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();
    await expect(bulk.locator("#progress")).toHaveText("Done: 1 of 1 scanned.");
    await expect(bulk.locator(".bulk-row").first()).toContainText("85"); // robots.txt blocks all -> critical
  });

  test("scans at most 50 URLs", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, BULK));
    await bulk.locator("#urls").fill(Array.from({ length: 55 }, (_, i) => `${SITE}/good.html?n=${i}`).join("\n"));
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();

    await expect(bulk.locator("#progress")).toHaveText("Done: 50 of 50 scanned.", { timeout: 40_000 });
    await expect(bulk.locator("#notice")).toContainText("Only the first 50 URLs are scanned; 5 more were ignored.");
    await expect(bulk.locator(".bulk-row")).toHaveCount(50);
  });

  test("asks for something to scan when the box is empty", async ({ context, extensionId }) => {
    await activatePro(context, extensionId);
    const bulk = await context.newPage();
    await bulk.goto(extensionPage(extensionId, BULK));
    await bulk.getByRole("button", { name: "Start bulk scan" }).click();
    await expect(bulk.locator("#notice")).toContainText("Paste at least one URL");
  });
});
