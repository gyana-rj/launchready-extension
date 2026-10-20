import type { ScanResult } from "./types";

const LAST_SCAN_KEY = "lastScan";

export async function saveLastScan(result: ScanResult): Promise<void> {
  await chrome.storage.local.set({ [LAST_SCAN_KEY]: result });
}

export async function loadLastScan(): Promise<ScanResult | undefined> {
  return (await chrome.storage.local.get(LAST_SCAN_KEY))[LAST_SCAN_KEY] as ScanResult | undefined;
}
