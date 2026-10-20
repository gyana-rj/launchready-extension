import "../ui/theme.css";
import { bulkScan, parseUrlList, type BulkRow } from "../bulk";
import { config } from "../config";
import { auditsToCsv, csvFilename, downloadFile } from "../csv";
import { addAudit } from "../history";
import { isPro } from "../license";
import { PAGES, pageUrl, renderNav, renderUpgradePrompt } from "../ui/pro";
import { countBySeverity, el } from "../ui/render";
import type { ScanResult, StoredAudit } from "../types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const startButton = $<HTMLButtonElement>("start");
let scanned: ScanResult[] = [];

function showNotice(lines: string[]) {
  $("notice").hidden = lines.length === 0;
  $("notice").textContent = lines.join(" ");
}

/** Row for a URL that is still waiting, then replaced when it finishes. */
function rowFor(url: string, row?: BulkRow, saved?: StoredAudit): HTMLElement {
  const tr = el("tr", "bulk-row");
  tr.dataset.url = url;
  if (!row) {
    tr.append(el("td", "url", url), el("td", "num", "–"), el("td", "num", "–"), el("td", "num", "–"), el("td", undefined, "Waiting…"));
    return tr;
  }
  if (!row.result) {
    tr.append(el("td", "url", url), el("td", "num", "–"), el("td", "num", "–"), el("td", "num", "–"), el("td", "row-error", `Failed: ${row.error}`));
    return tr;
  }
  const counts = countBySeverity(row.result.issues);
  const status = el("td", undefined, "Scanned");
  if (saved) {
    const link = el("a", undefined, "View report");
    link.href = `${pageUrl(PAGES.report)}?id=${encodeURIComponent(saved.id)}`;
    status.append(" · ", link);
  }
  tr.append(
    el("td", "url", url),
    el("td", "num", String(row.result.score)),
    el("td", "num", String(counts.critical)),
    el("td", "num", String(counts.warning)),
    status,
  );
  return tr;
}

/** Asks for access to the sites being scanned (optional host permissions). */
async function ensureAccess(urls: string[]): Promise<boolean> {
  const origins = [...new Set(urls.map((u) => `${new URL(u).protocol}//${new URL(u).hostname}/*`))];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}

async function onStart() {
  const { urls, invalid, ignored } = parseUrlList($<HTMLTextAreaElement>("urls").value);
  const notices: string[] = [];
  if (invalid.length) notices.push(`Skipped ${invalid.length} line(s) that aren't web addresses: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}.`);
  if (ignored) notices.push(`Only the first ${config.bulkScanLimit} URLs are scanned; ${ignored} more were ignored.`);
  showNotice(notices);
  if (!urls.length) {
    showNotice([...notices, "Paste at least one URL to scan."]);
    return;
  }

  startButton.disabled = true;
  $("export").hidden = true;
  scanned = [];
  try {
    if (!(await ensureAccess(urls))) {
      showNotice([...notices, "Permission to read those sites was not granted, so nothing was scanned."]);
      return;
    }
    $("table").hidden = false;
    $("rows").replaceChildren(...urls.map((url) => rowFor(url)));
    $("progress").textContent = `Scanned 0 of ${urls.length}`;

    // Rows are saved to history as they finish; wait for those writes before reporting "Done".
    const saves: Promise<void>[] = [];
    const rows = await bulkScan(urls, {
      onRow: (row, done, total) => {
        $("progress").textContent = `Scanned ${done} of ${total}`;
        const saving = row.result ? addAudit(row.result) : Promise.resolve(undefined);
        saves.push(saving.then((saved) => document.querySelector(`tr[data-url="${CSS.escape(row.url)}"]`)?.replaceWith(rowFor(row.url, row, saved))));
      },
    });
    await Promise.all(saves);
    scanned = rows.flatMap((row) => (row.result ? [row.result] : []));
    $("progress").textContent = `Done: ${scanned.length} of ${urls.length} scanned.`;
    $("export").hidden = scanned.length === 0;
  } finally {
    startButton.disabled = false;
  }
}

async function main() {
  renderNav($("nav"), "bulk");
  if (!(await isPro())) {
    renderUpgradePrompt($("locked"), "Bulk scan");
    return;
  }
  $("content").hidden = false;
  startButton.addEventListener("click", onStart);
  $("export").addEventListener("click", () => downloadFile(csvFilename(scanned), auditsToCsv(scanned)));
}

void main();
