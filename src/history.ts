import { config } from "./config";
import type { ScanResult, StoredAudit } from "./types";

const KEY = "history";

// Writes are read-modify-write, so they run one at a time (bulk scans save in parallel).
let queue: Promise<unknown> = Promise.resolve();

/** Saved audits, newest first. */
export async function getHistory(): Promise<StoredAudit[]> {
  return ((await chrome.storage.local.get(KEY))[KEY] as StoredAudit[] | undefined) ?? [];
}

export async function getAudit(id: string): Promise<StoredAudit | undefined> {
  return (await getHistory()).find((audit) => audit.id === id);
}

/** Saves an audit at the top of the history and drops the oldest beyond the limit. */
export function addAudit(result: ScanResult): Promise<StoredAudit> {
  const run = async () => {
    const audit: StoredAudit = { ...result, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
    const history = [audit, ...(await getHistory())].slice(0, config.historyLimit);
    await chrome.storage.local.set({ [KEY]: history });
    return audit;
  };
  const next = queue.then(run);
  queue = next.catch(() => undefined);
  return next;
}

export function clearHistory(): Promise<void> {
  const next = queue.then(() => chrome.storage.local.remove(KEY));
  queue = next.catch(() => undefined);
  return next;
}
