import { config } from "./config";

const KEY = "scanUsage";

interface Usage {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  count: number;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function loadUsage(): Promise<Usage> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as Usage | undefined;
  return stored?.date === today() ? stored : { date: today(), count: 0 };
}

/** Free scans left today. */
export async function getRemainingScans(): Promise<number> {
  return Math.max(0, config.freeScansPerDay - (await loadUsage()).count);
}

/** Call after a successful scan. */
export async function recordScan(): Promise<void> {
  const usage = await loadUsage();
  await chrome.storage.local.set({ [KEY]: { ...usage, count: usage.count + 1 } });
}
