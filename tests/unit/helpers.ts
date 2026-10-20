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
