import { expect, issueIds, openPopupFor, runScan, SITE, BLOCKED_SITE, test } from "./fixtures";

test("popup shows the scan button and the free scan allowance", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  await expect(popup.getByRole("button", { name: "Scan this page" })).toBeEnabled();
  await expect(popup.locator("#usage")).toHaveText("5 of 5 free scans left today");
  await expect(popup.locator("#results")).toBeHidden();
});

test("baseline page scores 100 with no problems", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  await runScan(popup);
  await expect(popup.locator("#score")).toHaveText("100/100");
  await expect(popup.locator(".all-clear")).toBeVisible();
  expect(await issueIds(popup)).toEqual(["page-stats"]);
  await expect(popup.locator("#usage")).toHaveText("4 of 5 free scans left today");
});

test("scan finds a critical issue, counts it, and shows how to fix it", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
  await runScan(popup);

  await expect(popup.locator("#score")).toHaveText("85/100");
  await expect(popup.locator('[data-severity="critical"] strong')).toHaveText("1");
  await expect(popup.locator('[data-severity="warning"] strong')).toHaveText("0");
  await expect(popup.locator('[data-severity="info"] strong')).toHaveText("1");

  const issue = popup.locator('[data-issue-id="noindex"]');
  await expect(issue).toContainText("Page is blocked from search engines");
  await expect(issue.locator(".how-to-fix")).toBeHidden(); // collapsed until expanded
  await issue.locator("summary").click();
  await expect(issue.locator(".how-to-fix")).toContainText("Remove the noindex directive");
});

const pageCases: [fixture: string, expected: string[]][] = [
  ["canonical-bad-host.bad.html", ["canonical-bad-host"]],
  ["missing-title.bad.html", ["missing-title"]],
  ["h1-multiple.bad.html", ["h1-multiple"]],
  ["img-alt-missing.bad.html", ["img-alt-missing"]],
  ["placeholder-text.bad.html", ["placeholder-text"]],
  ["og-missing.bad.html", ["og-title-missing", "og-description-missing", "og-image-missing"]],
  ["empty-links.bad.html", ["empty-links"]],
];
for (const [fixture, expected] of pageCases) {
  test(`scan finds ${expected.join(", ")} on ${fixture}`, async ({ context, extensionId }) => {
    const popup = await openPopupFor(context, extensionId, `${SITE}/${fixture}`);
    await runScan(popup);
    expect((await issueIds(popup)).filter((id) => id !== "page-stats")).toEqual(expected);
  });
}

test("scan reads response headers: X-Robots-Tag noindex", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html?x-robots=noindex`);
  await runScan(popup);
  expect(await issueIds(popup)).toContain("noindex");
});

test("scan fetches robots.txt: Disallow / is flagged", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${BLOCKED_SITE}/good.html`);
  await runScan(popup);
  expect(await issueIds(popup)).toContain("robots-txt-blocks-all");
});

test("scan checks same-origin links: a 404 is reported as broken", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/broken-links.bad.html`);
  await runScan(popup);
  const issue = popup.locator('[data-issue-id="broken-links"]');
  await expect(issue).toBeVisible();
  await issue.locator("summary").click();
  await expect(issue.locator("code")).toHaveText(`${SITE}/missing-page (404)`);
});

test("the 6th scan of the day is blocked with a clear message", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  const scan = popup.getByRole("button", { name: "Scan this page" });

  for (let used = 1; used <= 5; used++) {
    await expect(scan).toBeEnabled();
    await scan.click();
    await expect(popup.locator("#usage")).toHaveText(`${5 - used} of 5 free scans left today`);
  }

  await expect(scan).toBeDisabled();
  await expect(popup.locator("#message")).toContainText("Daily limit reached");
  await expect(popup.locator("#message")).toContainText("5 free scans");

  // Still blocked after reopening the popup (the count is stored, not in memory).
  await popup.reload();
  await expect(popup.getByRole("button", { name: "Scan this page" })).toBeDisabled();
  await expect(popup.locator("#message")).toContainText("Daily limit reached");
});

test("the daily count resets on a new day", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  await popup.evaluate(() => chrome.storage.local.set({ scanUsage: { date: "2000-01-01", count: 5 } }));
  await popup.reload();
  await expect(popup.locator("#usage")).toHaveText("5 of 5 free scans left today");
  await expect(popup.getByRole("button", { name: "Scan this page" })).toBeEnabled();
});

test("pages that can't be scripted show an error and don't use up a scan", async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  const ownTabId = await popup.evaluate(async () => (await chrome.tabs.getCurrent())?.id);
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?tab=${ownTabId}`);

  await popup.getByRole("button", { name: "Scan this page" }).click();
  await expect(popup.locator("#message")).toContainText("can't be scanned");
  await expect(popup.locator("#results")).toBeHidden();
  await expect(popup.locator("#usage")).toHaveText("5 of 5 free scans left today");
});

test("'Open full report' opens the report page with the scan", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/noindex.bad.html`);
  await runScan(popup);

  const [report] = await Promise.all([context.waitForEvent("page"), popup.getByRole("button", { name: "Open full report" }).click()]);
  await report.waitForLoadState();
  expect(report.url()).toBe(`chrome-extension://${extensionId}/src/report/report.html`);
  await expect(report.locator("#page")).toContainText(`${SITE}/noindex.bad.html`);
  await expect(report.locator("#score")).toHaveText("85/100");
  await expect(report.locator('[data-issue-id="noindex"]')).toBeVisible();
});

test("report page shows an empty state before any scan", async ({ context, extensionId }) => {
  const report = await context.newPage();
  await report.goto(`chrome-extension://${extensionId}/src/report/report.html`);
  await expect(report.locator("#empty")).toBeVisible();
});

test("supports light and dark mode", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/good.html`);
  const background = () => popup.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await popup.emulateMedia({ colorScheme: "light" });
  const light = await background();
  await popup.emulateMedia({ colorScheme: "dark" });
  const dark = await background();

  expect(light).toBe("rgb(255, 255, 255)");
  expect(dark).not.toBe(light);
});

test("page content can't inject HTML into the popup", async ({ context, extensionId }) => {
  const popup = await openPopupFor(context, extensionId, `${SITE}/escaping.html`);
  await runScan(popup);
  await popup.locator('[data-issue-id="img-alt-missing"] summary').click();
  // The snippet is shown as text, not parsed into a live <img> in the popup.
  await expect(popup.locator('[data-issue-id="img-alt-missing"] code')).toContainText('<img src="x" onerror=');
  await expect(popup.locator("#issues img")).toHaveCount(0);
});
