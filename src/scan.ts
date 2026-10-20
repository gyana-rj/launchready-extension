import type { ScanResult } from "./types";

/** Injects the engine into the tab and returns the scan result. Throws if the tab can't be scripted. */
export async function scanTab(tabId: number): Promise<ScanResult> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (window as unknown as { __launchreadyScan: () => Promise<ScanResult> }).__launchreadyScan(),
  });
  if (!injection?.result) throw new Error("The page returned no scan result");
  return injection.result;
}
