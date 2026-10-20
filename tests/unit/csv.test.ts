import { describe, expect, it } from "vitest";
import { auditsToCsv, csvFilename } from "../../src/csv";
import type { Issue, ScanResult } from "../../src/types";

const issue = (extra: Partial<Issue> = {}): Issue => ({
  id: "noindex",
  severity: "critical",
  title: "Page is blocked",
  description: "Search engines won't index it.",
  howToFix: "Remove the tag.",
  elements: ['<meta name="robots" content="noindex">'],
  ...extra,
});
const audit = (issues: Issue[], url = "https://www.acme.com/a"): ScanResult => ({ url, title: "A", scannedAt: Date.UTC(2026, 0, 2, 3, 4, 5), score: 85, issues });

/** Splits CSV text into rows of cells (handles quoted cells). */
function parse(csv: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (rows.at(-1)!.push(cell), (cell = ""));
    else if (c === "\r") continue;
    else if (c === "\n") (rows.at(-1)!.push(cell), (cell = ""), rows.push([]));
    else cell += c;
  }
  return rows.filter((r) => r.length);
}

describe("auditsToCsv", () => {
  it("starts with a BOM and a header row", () => {
    const csv = auditsToCsv([audit([issue()])]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parse(csv.slice(1))[0]).toEqual(["Scanned at", "URL", "Score", "Severity", "Issue ID", "Issue", "Description", "How to fix", "Elements"]);
  });

  it("writes one row per issue per audit", () => {
    const csv = auditsToCsv([audit([issue(), issue({ id: "x", severity: "warning" })]), audit([issue()], "https://b.com/")]);
    const rows = parse(csv.slice(1));
    expect(rows).toHaveLength(4);
    expect(rows[1]).toEqual(["2026-01-02T03:04:05.000Z", "https://www.acme.com/a", "85", "critical", "noindex", "Page is blocked", "Search engines won't index it.", "Remove the tag.", '<meta name="robots" content="noindex">']);
    expect(rows[3][1]).toBe("https://b.com/");
  });

  it("quotes commas, quotes and newlines", () => {
    const rows = parse(auditsToCsv([audit([issue({ title: 'He said "hi", twice', description: "line1\nline2" })])]).slice(1));
    expect(rows[1][5]).toBe('He said "hi", twice');
    expect(rows[1][6]).toBe("line1\nline2");
  });

  it("joins several elements with ' | '", () => {
    const rows = parse(auditsToCsv([audit([issue({ elements: ["<a>", "<b>"] })])]).slice(1));
    expect(rows[1][8]).toBe("<a> | <b>");
  });

  it("neutralises spreadsheet formulas from page content", () => {
    const rows = parse(auditsToCsv([audit([issue({ title: "=HYPERLINK(\"http://evil\")", elements: ["@SUM(1)", "+1"] })])]).slice(1));
    expect(rows[1][5].startsWith("'=")).toBe(true);
    expect(rows[1][8].startsWith("'@")).toBe(true);
  });
});

describe("csvFilename", () => {
  it("names a single audit after its host", () => {
    expect(csvFilename([audit([])])).toMatch(/^launchready-www\.acme\.com-\d{4}-\d{2}-\d{2}\.csv$/);
  });
  it("uses a generic name for several audits", () => {
    expect(csvFilename([audit([]), audit([])])).toMatch(/^launchready-audits-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
