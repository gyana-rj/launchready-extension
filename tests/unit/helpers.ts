import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AuditContext } from "../../src/engine";

export const PAGE_URL = "https://www.acme-plumbing.com/";
export const ctx: AuditContext = { url: PAGE_URL };

export function readFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "../fixtures", name), "utf8");
}

export function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function loadFixture(name: string): Document {
  return parse(readFixture(name));
}

import { vi } from "vitest";

/** Minimal in-memory chrome.storage.local. Returns the backing object. */
export function stubChromeStorage(initial: Record<string, unknown> = {}): Record<string, unknown> {
  const data = { ...initial };
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
        set: async (items: Record<string, unknown>) => void Object.assign(data, items),
        remove: async (key: string) => void delete data[key],
      },
    },
  });
  return data;
}
