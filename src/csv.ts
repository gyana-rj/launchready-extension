import { todayISO } from "./branding";
import type { ScanResult } from "./types";

const HEADER = ["Scanned at", "URL", "Score", "Severity", "Issue ID", "Issue", "Description", "How to fix", "Elements"];

function cell(value: string | number): string {
  let text = String(value);
  // Stop spreadsheet apps from running page-supplied text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row per issue per audit. Starts with a BOM so Excel reads it as UTF-8. */
export function auditsToCsv(audits: ScanResult[]): string {
  const rows = [
    HEADER,
    ...audits.flatMap((audit) =>
      audit.issues.map((issue) => [
        new Date(audit.scannedAt).toISOString(),
        audit.url,
        audit.score,
        issue.severity,
        issue.id,
        issue.title,
        issue.description,
        issue.howToFix,
        issue.elements.join(" | "),
      ]),
    ),
  ];
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvFilename(audits: ScanResult[]): string {
  if (audits.length === 1) {
    let host = "page";
    try {
      host = new URL(audits[0].url).hostname.replace(/[^a-z0-9.-]/gi, "-");
    } catch {
      // keep "page"
    }
    return `launchready-${host}-${todayISO()}.csv`;
  }
  return `launchready-audits-${todayISO()}.csv`;
}

/** Saves text as a file through the browser's download. */
export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
