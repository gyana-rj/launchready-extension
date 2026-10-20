import type { Issue, Severity } from "../types";

/** Points lost per issue. Info issues do not affect the score. */
export const PENALTY: Record<Severity, number> = { critical: 15, warning: 5, info: 0 };

export function calculateScore(issues: Issue[]): number {
  const lost = issues.reduce((sum, issue) => sum + PENALTY[issue.severity], 0);
  return Math.max(0, 100 - lost);
}
