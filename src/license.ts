import { BETA_MODE } from "./config";

// The single place that decides whether the user is Pro. Every Pro feature calls isPro().
// STUB: keys are checked against a local list. Replace isValidKey() with the payment
// provider's validation later; nothing else needs to change.

const STORAGE_KEY = "license";
// The test key is only compiled in when VITE_ENABLE_TEST_KEY=true (test and e2e builds, see .env.test
// and .env.e2e). In a production build this folds to an empty list, so "TEST-PRO" never ships.
// tests/unit/bundle.test.ts checks that.
const STUB_KEYS = new Set<string>(import.meta.env.VITE_ENABLE_TEST_KEY === "true" ? ["TEST-PRO"] : []);

export type ActivationResult = { ok: true } | { ok: false; error: string };

function normalize(key: string): string {
  return key.trim().toUpperCase();
}

function isValidKey(key: string): boolean {
  return STUB_KEYS.has(normalize(key));
}

export async function isPro(): Promise<boolean> {
  if (BETA_MODE) return true;
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as { key?: string } | undefined;
  return !!stored?.key && isValidKey(stored.key);
}

export async function activate(key: string): Promise<ActivationResult> {
  if (!key.trim()) return { ok: false, error: "Enter a license key." };
  if (!isValidKey(key)) return { ok: false, error: "That license key isn't valid. Check it and try again." };
  await chrome.storage.local.set({ [STORAGE_KEY]: { key: normalize(key), activatedAt: Date.now() } });
  return { ok: true };
}

export async function deactivate(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
