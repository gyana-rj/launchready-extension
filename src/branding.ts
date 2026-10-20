import type { Branding } from "./types";

const KEY = "branding";

export const EMPTY_BRANDING: Branding = { agencyName: "", clientName: "", date: "", logo: "" };

export async function getBranding(): Promise<Branding> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as Partial<Branding> | undefined;
  return { ...EMPTY_BRANDING, ...stored };
}

export async function saveBranding(branding: Branding): Promise<void> {
  await chrome.storage.local.set({ [KEY]: branding });
}

/** Local date as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
