import "../ui/theme.css";
import "./popup.css";
import { BETA_MODE, config, FEEDBACK_URL } from "../config";
import { describeScanError } from "../errors";
import { auditsToCsv, csvFilename, downloadFile } from "../csv";
import { addAudit } from "../history";
import { isPro } from "../license";
import { getRemainingScans, recordScan } from "../limits";
import { scanTab } from "../scan";
import { saveLastScan } from "../store";
import type { ScanResult } from "../types";
import { openPage, PAGES } from "../ui/pro";
import { renderCounts, renderIssueList, renderScore, renderSkipped } from "../ui/render";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scanButton = $<HTMLButtonElement>("scan");

let current: ScanResult | undefined;
/** Id of the current scan in the audit history (Pro only). */
let currentAuditId: string | undefined;

function showMessage(text: string, kind: "limit" | "error" | "upgrade") {
  const message = $("message");
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

function showResults(result: ScanResult) {
  $("page").textContent = result.url;
  renderScore($("score"), result.score);
  renderCounts($("counts"), result.issues);
  renderIssueList($("issues"), result.issues);
  renderSkipped($("skipped"), result.skipped);
  $("results").hidden = false;
}

/** Updates the plan badge, usage line and scan button. */
async function refreshUsage(): Promise<void> {
  const pro = await isPro();
  // In the free beta everyone is Pro, so the badge says so instead of "PRO".
  $("pro-badge").textContent = BETA_MODE ? "Free during beta" : "PRO";
  $("pro-badge").hidden = !pro;
  $("export").textContent = pro ? "Export CSV" : "Export CSV (Pro)";

  if (pro) {
    $("usage").textContent = "Unlimited scans";
    scanButton.disabled = false;
    $("upgrade").hidden = true;
    return;
  }
  const left = await getRemainingScans();
  $("usage").textContent = `${left} of ${config.freeScansPerDay} free scans left today`;
  scanButton.disabled = left === 0;
  if (left === 0) {
    showMessage(
      `Daily limit reached: you've used all ${config.freeScansPerDay} free scans for today. The limit resets at midnight. Pro gives you unlimited scans.`,
      "limit",
    );
    $("upgrade").hidden = false;
  }
}

/** The tab to scan: the active tab, or ?tab=<id> (used by the e2e tests, where the popup is opened as a tab). */
async function targetTabId(): Promise<number | undefined> {
  const override = new URLSearchParams(location.search).get("tab");
  if (override) return Number(override);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function setScanning(scanning: boolean) {
  scanButton.disabled = scanning;
  scanButton.textContent = scanning ? "Scanning…" : "Scan this page";
  $("loading").hidden = !scanning;
  $("results").setAttribute("aria-busy", String(scanning));
}

/** Saves a finished scan. Returns false if browser storage refused (full or unavailable). */
async function saveScan(result: ScanResult, pro: boolean): Promise<boolean> {
  try {
    if (pro) currentAuditId = (await addAudit(result)).id;
    else await recordScan();
    await saveLastScan(result);
    return true;
  } catch {
    return false;
  }
}

async function onScan() {
  const pro = await isPro();
  if (!pro && (await getRemainingScans()) === 0) return void (await refreshUsage());

  setScanning(true);
  $("hint").hidden = true;
  $("message").hidden = true;
  $("results").hidden = true;
  currentAuditId = undefined;
  try {
    const tabId = await targetTabId();
    if (tabId === undefined) throw new Error("No active tab");
    const result = await scanTab(tabId);
    current = result;
    const saved = await saveScan(result, pro);
    showResults(result);
    if (!saved) {
      showMessage(
        "The scan finished, but it couldn't be saved because browser storage is full or unavailable. On the History page you can clear old audits.",
        "error",
      );
    }
  } catch (error) {
    showMessage(describeScanError(error), "error");
  } finally {
    setScanning(false);
    await refreshUsage();
  }
}

scanButton.addEventListener("click", onScan);
$("report").addEventListener("click", () => {
  openPage(currentAuditId ? `${PAGES.report}?id=${encodeURIComponent(currentAuditId)}` : PAGES.report);
});
$("export").addEventListener("click", async () => {
  if (!current) return;
  if (!(await isPro())) {
    showMessage("CSV export is a Pro feature. Upgrade to download your results.", "upgrade");
    $("upgrade").hidden = false;
    return;
  }
  downloadFile(csvFilename([current]), auditsToCsv([current]));
});
$("upgrade").addEventListener("click", () => openPage(PAGES.settings));
$("link-history").addEventListener("click", () => openPage(PAGES.history));
$("link-bulk").addEventListener("click", () => openPage(PAGES.bulk));
$("link-settings").addEventListener("click", () => openPage(PAGES.settings));
$("link-privacy").addEventListener("click", () => openPage(PAGES.privacy));
$<HTMLAnchorElement>("link-feedback").href = FEEDBACK_URL;
void refreshUsage();
