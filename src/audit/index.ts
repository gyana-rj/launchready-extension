import type { Issue } from "../types";

export interface AuditContext {
  /** Response headers of the page, lower-cased names. */
  headers?: Record<string, string>;
  /** Text of /robots.txt, if fetched. */
  robotsTxt?: string;
}

/** Pure entry point: Document in, issues out. Checks are added in Phase 2. */
export function runAudit(_doc: Document, _ctx: AuditContext = {}): Issue[] {
  return [];
}
