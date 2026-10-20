import type { Issue, Severity } from "../types";

const SEVERITIES: { severity: Severity; label: string; plural: string }[] = [
  { severity: "critical", label: "Critical", plural: "Critical issues" },
  { severity: "warning", label: "Warning", plural: "Warnings" },
  { severity: "info", label: "Info", plural: "Info" },
];

/** Builds an element. Text always goes through textContent, since issue data comes from scanned pages. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity]++;
  return counts;
}

export function renderScore(container: HTMLElement, score: number): void {
  const level = score >= 90 ? "good" : score >= 60 ? "fair" : "poor";
  container.className = `score score-${level}`;
  container.replaceChildren(el("span", "score-number", String(score)), el("span", "score-of", "/100"));
}

export function renderCounts(container: HTMLElement, issues: Issue[]): void {
  const counts = countBySeverity(issues);
  container.replaceChildren(
    ...SEVERITIES.map(({ severity, label }) => {
      const chip = el("div", `count count-${severity}`);
      chip.dataset.severity = severity;
      chip.append(el("strong", undefined, String(counts[severity])), el("span", undefined, label));
      return chip;
    }),
  );
}

function renderIssue(issue: Issue, open: boolean): HTMLElement {
  const item = el("details", `issue issue-${issue.severity}`);
  item.open = open;
  item.dataset.issueId = issue.id;
  item.append(el("summary", undefined, issue.title));

  const body = el("div", "issue-body");
  body.append(el("p", undefined, issue.description), el("h4", undefined, "How to fix"), el("p", "how-to-fix", issue.howToFix));
  if (issue.elements.length) {
    const list = el("ul", "elements");
    for (const element of issue.elements) {
      const li = el("li");
      li.append(el("code", undefined, element));
      list.append(li);
    }
    body.append(el("h4", undefined, "Where"), list);
  }
  item.append(body);
  return item;
}

/** Issues grouped by severity, each expandable (collapsed unless `open`). */
export function renderIssueList(container: HTMLElement, issues: Issue[], options: { open?: boolean } = {}): void {
  const problems = issues.filter((i) => i.severity !== "info");
  const groups = SEVERITIES.flatMap(({ severity, plural }) => {
    const inGroup = issues.filter((i) => i.severity === severity);
    if (!inGroup.length) return [];
    const group = el("section", "issue-group");
    group.append(el("h3", undefined, `${plural} (${inGroup.length})`), ...inGroup.map((issue) => renderIssue(issue, options.open ?? false)));
    return [group];
  });
  const empty = problems.length ? [] : [el("p", "all-clear", "No problems found. This page looks ready to launch.")];
  container.replaceChildren(...empty, ...groups);
}

/** Note listing checks that couldn't run. Hidden when there are none. */
export function renderSkipped(container: HTMLElement, skipped: string[] | undefined): void {
  container.hidden = !skipped?.length;
  container.replaceChildren(...(skipped ?? []).map((text) => el("span", undefined, text)));
}
