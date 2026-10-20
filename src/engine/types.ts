import type { Issue } from "../types";

/** Optional extra inputs for an audit. The Document itself is passed separately. */
export interface AuditContext {
  /** URL of the page. Falls back to doc.URL when that is http(s). */
  url?: string;
  /** Response headers of the page, with lower-case names. */
  headers?: Record<string, string>;
  /** Text of the site's /robots.txt. */
  robotsTxt?: string;
  /** HTTP status per checked link URL (0 = no response). See linkChecker.ts. */
  linkResults?: Record<string, number>;
}

/** A check is a pure function: no network, no DOM mutation. */
export type Check = (doc: Document, ctx: AuditContext) => Issue[];
