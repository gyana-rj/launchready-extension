import type { Issue } from "../types";
import { criticalChecks } from "./checks/critical";
import { infoChecks } from "./checks/info";
import { warningChecks } from "./checks/warnings";
import { calculateScore } from "./score";
import type { AuditContext, Check } from "./types";

export type { AuditContext, Check } from "./types";
export { calculateScore } from "./score";
export { checkLinks, getSameOriginLinks } from "./linkChecker";

export interface AuditResult {
  /** Ordered critical, warning, info. */
  issues: Issue[];
  /** 0-100. */
  score: number;
}

const checks: Check[] = [...criticalChecks, ...warningChecks, ...infoChecks];

/** Runs every check on the document. Pure: no network, no DOM changes. */
export function runAudit(doc: Document, ctx: AuditContext = {}): AuditResult {
  const issues = checks.flatMap((check) => check(doc, ctx));
  return { issues, score: calculateScore(issues) };
}
