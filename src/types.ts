export type Severity = "critical" | "warning" | "info";

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  howToFix: string;
  /** CSS selectors or snippets, max 10. */
  elements: string[];
}

export interface ScanResult {
  url: string;
  title: string;
  /** Epoch milliseconds. */
  scannedAt: number;
  /** 0-100. */
  score: number;
  issues: Issue[];
}
