import { describe, expect, it } from "vitest";
import type { Issue } from "../../src/types";
import { countBySeverity, renderCounts, renderIssueList, renderScore } from "../../src/ui/render";

const issue = (id: string, severity: Issue["severity"], extra: Partial<Issue> = {}): Issue => ({
  id,
  severity,
  title: `Title ${id}`,
  description: `Description ${id}`,
  howToFix: `Fix ${id}`,
  elements: [],
  ...extra,
});

describe("render", () => {
  it("counts issues per severity", () => {
    expect(countBySeverity([issue("a", "critical"), issue("b", "warning"), issue("c", "warning")])).toEqual({
      critical: 1,
      warning: 2,
      info: 0,
    });
  });

  it("renders the score with a colour level", () => {
    const box = document.createElement("div");
    renderScore(box, 95);
    expect(box.textContent).toBe("95/100");
    expect(box.className).toContain("score-good");
    renderScore(box, 70);
    expect(box.className).toContain("score-fair");
    renderScore(box, 20);
    expect(box.className).toContain("score-poor");
  });

  it("renders a count per severity", () => {
    const box = document.createElement("div");
    renderCounts(box, [issue("a", "critical")]);
    expect(box.querySelector('[data-severity="critical"] strong')?.textContent).toBe("1");
    expect(box.querySelector('[data-severity="info"] strong')?.textContent).toBe("0");
  });

  it("groups issues by severity, critical first, each with how-to-fix text", () => {
    const box = document.createElement("div");
    renderIssueList(box, [issue("w", "warning"), issue("c", "critical"), issue("i", "info")]);
    expect(Array.from(box.querySelectorAll("h3"), (h) => h.textContent)).toEqual(["Critical issues (1)", "Warnings (1)", "Info (1)"]);
    expect(box.querySelector('[data-issue-id="c"] .how-to-fix')?.textContent).toBe("Fix c");
    expect(box.querySelector(".all-clear")).toBeNull();
  });

  it("shows an all-clear message when there are only info issues", () => {
    const box = document.createElement("div");
    renderIssueList(box, [issue("i", "info")]);
    expect(box.querySelector(".all-clear")).not.toBeNull();
  });

  it("treats issue text as text, never HTML", () => {
    const box = document.createElement("div");
    renderIssueList(box, [issue("x", "warning", { title: "<b>bold</b>", elements: ['<img src=x onerror="alert(1)">'] })]);
    expect(box.querySelector("b")).toBeNull();
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("code")?.textContent).toBe('<img src=x onerror="alert(1)">');
  });
});
