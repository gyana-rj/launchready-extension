// Runs against dist-e2e-beta: built like production (beta mode on, no test key), plus test host permissions.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, extensionPage, openPopupFor, readDownload, runScan, SITE, test } from "./fixtures";

const FEEDBACK = "mailto:devgyanaranjan@gmail.com?subject=LaunchReady%20feedback";

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

test("the beta build does not contain the TEST-PRO key", async ({ extensionDir }) => {
  const leaks = filesIn(resolve(extensionDir)).filter((file) => readFileSync(file).includes("TEST-PRO"));
  expect(leaks).toEqual([]);
});

test("popup says 'Free during beta' and has no upgrade prompts or limit", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  await expect(popup.locator("#pro-badge")).toHaveText("Free during beta");
  await expect(popup.locator("#usage")).toHaveText("Unlimited scans");
  await expect(popup.getByRole("button", { name: "Upgrade to Pro" })).toHaveCount(0);

  // Well past the free limit of 5 scans a day.
  for (let scan = 1; scan <= 7; scan++) {
    await runScan(popup);
    await expect(popup.getByRole("button", { name: "Scan this page" })).toBeEnabled();
  }
  await expect(popup.locator("#message")).toBeHidden();
  await expect(popup.locator("#usage")).toHaveText("Unlimited scans");
});

test("Pro features work for everyone: history, CSV, report branding", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
  await runScan(popup);

  // CSV export isn't labelled "(Pro)" and downloads.
  const [download] = await Promise.all([popup.waitForEvent("download"), popup.getByRole("button", { name: "Export CSV", exact: true }).click()]);
  expect((await readDownload(download)).replace("﻿", "")).toContain("noindex");

  // The scan was saved to history.
  const history = await context.newPage();
  await history.goto(extensionPage(extensionId, "src/history/history.html"));
  await expect(history.locator(".upgrade")).toHaveCount(0);
  await expect(history.locator(".audit-row")).toHaveCount(1);

  // The report has the branding panel.
  const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
  await report.waitForLoadState();
  await expect(report.locator("#branding-panel")).toBeVisible();
  await expect(report.locator("#branding-locked .upgrade")).toHaveCount(0);
  await report.getByLabel("Agency name").fill("Pixel & Co");
  await expect(report.locator("#agency")).toHaveText("Pixel & Co");
});

test("bulk scan works for everyone", async ({ context, extensionId }) => {
  const bulk = await context.newPage();
  await bulk.goto(extensionPage(extensionId, "src/bulk/bulk.html"));
  await expect(bulk.locator(".upgrade")).toHaveCount(0);
  await expect(bulk.locator("#js-note")).toContainText("JavaScript-rendered content is not included");
  await bulk.locator("#urls").fill(`${SITE}/good.html`);
  await bulk.getByRole("button", { name: "Start bulk scan" }).click();
  await expect(bulk.locator("#progress")).toHaveText("Done: 1 of 1 scanned.");
});

test("settings shows 'Free during beta' with no license field, prices or upgrade prompt", async ({ context, extensionId }) => {
  const settings = await context.newPage();
  await settings.goto(extensionPage(extensionId, "src/settings/settings.html"));
  await expect(settings.locator("#plan")).toHaveText("Free during beta");
  await expect(settings.locator("#plan-detail")).toContainText("Every feature is free while LaunchReady is in beta");
  await expect(settings.locator("#license-panel")).toBeHidden();
  await expect(settings.locator("#key")).toBeHidden();
  await expect(settings.getByRole("button", { name: "Activate" })).toBeHidden();
  await expect(settings.locator("#pricing")).toBeHidden();
  await expect(settings.locator("#pro-list")).toBeHidden();
  const visibleText = await settings.locator("body").innerText();
  expect(visibleText).not.toMatch(/Upgrade to Pro|\$\d|license key/i);
});

test("popup has a Send feedback link to the right email", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  const link = popup.getByRole("link", { name: "Send feedback" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", FEEDBACK);
});

test("privacy policy shows the contact email", async ({ context, extensionId }) => {
  const privacy = await context.newPage();
  await privacy.goto(extensionPage(extensionId, "src/privacy/privacy.html"));
  await expect(privacy.getByRole("link", { name: "devgyanaranjan@gmail.com" })).toHaveAttribute("href", "mailto:devgyanaranjan@gmail.com");
  await expect(privacy.locator("body")).not.toContainText("add your contact email");
  await expect(privacy.locator("body")).toContainText("free beta");
});
