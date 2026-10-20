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
  /** Checks that couldn't run (for example a fetch failed). Shown to the user as a note. */
  skipped?: string[];
}

/** A scan saved in the audit history. */
export interface StoredAudit extends ScanResult {
  id: string;
}

/** Report branding (Pro). */
export interface Branding {
  agencyName: string;
  clientName: string;
  /** YYYY-MM-DD. Empty means "today" when the report is shown. */
  date: string;
  /** data: URL of the uploaded logo, or empty. */
  logo: string;
}
