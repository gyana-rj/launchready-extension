// Injected into the scanned tab (see scan.ts). Runs the audit engine on the live page.
// Fetches run in the page's own context, so same-origin requests need no host permission.
import type { ScanResult } from "../types";
import { collectScan } from "./collect";

const TIMEOUT_MS = 8000;

const timedFetch = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

function scanPage(): Promise<ScanResult> {
  return collectScan(document, location.href, timedFetch);
}

(window as unknown as { __launchreadyScan: typeof scanPage }).__launchreadyScan = scanPage;
