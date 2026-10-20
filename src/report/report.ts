import "../ui/theme.css";
import "./report.css";
import { loadLastScan } from "../store";
import { renderCounts, renderIssueList, renderScore } from "../ui/render";

const $ = (id: string) => document.getElementById(id)!;

async function main() {
  const scan = await loadLastScan();
  if (!scan) {
    $("empty").hidden = false;
    return;
  }
  $("page").textContent = scan.title ? `${scan.title} (${scan.url})` : scan.url;
  $("date").textContent = `Scanned ${new Date(scan.scannedAt).toLocaleString()}`;
  renderScore($("score"), scan.score);
  renderCounts($("counts"), scan.issues);
  renderIssueList($("issues"), scan.issues);
  $("report").hidden = false;
}

void main();
