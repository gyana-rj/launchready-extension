import "../ui/theme.css";
import "./popup.css";
import { config } from "../config";
import { getRemainingScans, recordScan } from "../limits";
import { scanTab } from "../scan";
import { saveLastScan } from "../store";
import type { ScanResult } from "../types";
import { renderCounts, renderIssueList, renderScore } from "../ui/render";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scanButton = $<HTMLButtonElement>("scan");

function showMessage(text: string, kind: "limit" | "error") {
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
  $("results").hidden = false;
}

/** Updates the usage line and the button; returns scans left. */
async function refreshUsage(): Promise<number> {
  const left = await getRemainingScans();
  $("usage").textContent = `${left} of ${config.freeScansPerDay} free scans left today`;
  scanButton.disabled = left === 0;
  if (left === 0) {
    showMessage(
      `Daily limit reached: you've used all ${config.freeScansPerDay} free scans for today. The limit resets at midnight. Pro gives you unlimited scans.`,
      "limit",
    );
  }
  return left;
}

/** The tab to scan: the active tab, or ?tab=<id> (used by the e2e tests, where the popup is opened as a tab). */
async function targetTabId(): Promise<number | undefined> {
  const override = new URLSearchParams(location.search).get("tab");
  if (override) return Number(override);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function onScan() {
  if ((await getRemainingScans()) === 0) return void (await refreshUsage());

  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  $("message").hidden = true;
  try {
    const tabId = await targetTabId();
    if (tabId === undefined) throw new Error("No active tab");
    const result = await scanTab(tabId);
    await recordScan();
    await saveLastScan(result);
    showResults(result);
  } catch {
    showMessage(
      "This page can't be scanned. Browser pages (chrome://), the Chrome Web Store and other protected pages are off limits.",
      "error",
    );
  } finally {
    scanButton.textContent = "Scan this page";
    await refreshUsage();
  }
}

scanButton.addEventListener("click", onScan);
$("report").addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("src/report/report.html") });
});
void refreshUsage();
