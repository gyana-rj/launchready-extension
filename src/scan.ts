import { explainUnscannable, ScanTimeoutError, UnscannableError } from "./errors";
import type { ScanResult } from "./types";

const SCAN_TIMEOUT_MS = 60_000;

async function inject(tabId: number): Promise<ScanResult> {
  const tab = await chrome.tabs.get(tabId);
  const blocked = explainUnscannable(tab.url);
  if (blocked) throw new UnscannableError(blocked);

  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (window as unknown as { __launchreadyScan: () => Promise<ScanResult> }).__launchreadyScan(),
  });
  if (!injection?.result) throw new Error("The page returned no scan result");
  return injection.result;
}

/**
 * Injects the engine into the tab and returns the scan result.
 * Throws UnscannableError, ScanTimeoutError or the browser's error; pass it to describeScanError().
 */
export async function scanTab(tabId: number): Promise<ScanResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ScanTimeoutError()), SCAN_TIMEOUT_MS);
  });
  try {
    return await Promise.race([inject(tabId), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
