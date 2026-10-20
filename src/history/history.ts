import "../ui/theme.css";
import { config } from "../config";
import { auditsToCsv, csvFilename, downloadFile } from "../csv";
import { clearHistory, getHistory } from "../history";
import { isPro } from "../license";
import { PAGES, pageUrl, renderNav, renderUpgradePrompt } from "../ui/pro";
import { countBySeverity, el } from "../ui/render";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function render() {
  const history = await getHistory();
  $("empty").hidden = history.length > 0;
  $("table").hidden = history.length === 0;
  $<HTMLButtonElement>("export").disabled = history.length === 0;
  $<HTMLButtonElement>("clear").disabled = history.length === 0;
  $("count").textContent = `${history.length} of ${config.historyLimit} audits stored`;

  $("rows").replaceChildren(
    ...history.map((audit) => {
      const counts = countBySeverity(audit.issues);
      const link = el("a", undefined, "View report");
      link.href = `${pageUrl(PAGES.report)}?id=${encodeURIComponent(audit.id)}`;
      const row = el("tr", "audit-row");
      const cells = [
        el("td", undefined, new Date(audit.scannedAt).toLocaleString()),
        el("td", "url", audit.url),
        el("td", "num", String(audit.score)),
        el("td", "num", String(counts.critical)),
        el("td", "num", String(counts.warning)),
        el("td"),
      ];
      cells[5].append(link);
      row.append(...cells);
      return row;
    }),
  );
}

async function main() {
  renderNav($("nav"), "history");
  const pro = await isPro();
  $("loading").hidden = true;
  if (!pro) {
    renderUpgradePrompt($("locked"), "Audit history");
    return;
  }
  $("content").hidden = false;
  $("export").addEventListener("click", async () => {
    const history = await getHistory();
    downloadFile(csvFilename(history), auditsToCsv(history));
  });
  $("clear").addEventListener("click", async () => {
    if (confirm("Delete all saved audits? This can't be undone.")) {
      await clearHistory();
      await render();
    }
  });
  await render();
}

void main();
