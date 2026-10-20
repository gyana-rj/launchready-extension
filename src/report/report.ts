import "../ui/theme.css";
import "./report.css";
import { getBranding, saveBranding, todayISO } from "../branding";
import { getAudit } from "../history";
import { isPro } from "../license";
import { loadLastScan } from "../store";
import type { Branding } from "../types";
import { renderNav, renderUpgradePrompt } from "../ui/pro";
import { renderCounts, renderIssueList, renderScore } from "../ui/render";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const MAX_LOGO_BYTES = 1024 * 1024;

/** The audit from ?id= (history), otherwise the most recent scan. */
async function loadAudit() {
  const id = new URLSearchParams(location.search).get("id");
  return (id ? await getAudit(id) : undefined) ?? (await loadLastScan());
}

function renderBranding(branding: Branding, pro: boolean) {
  const agency = $("agency");
  agency.textContent = pro ? branding.agencyName : "";
  agency.hidden = !agency.textContent;

  $("client").textContent = pro ? branding.clientName : "";
  $("client-row").hidden = !$("client").textContent;

  const date = pro && branding.date ? branding.date : todayISO();
  $("report-date").textContent = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "long" });

  const logo = $<HTMLImageElement>("logo");
  logo.hidden = !(pro && branding.logo);
  logo.src = pro ? branding.logo : "";
  logo.alt = branding.agencyName ? `${branding.agencyName} logo` : "Logo";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function setupBrandingPanel(branding: Branding) {
  $("branding-panel").hidden = false;
  $<HTMLInputElement>("agency-input").value = branding.agencyName;
  $<HTMLInputElement>("client-input").value = branding.clientName;
  $<HTMLInputElement>("date-input").value = branding.date || todayISO();
  $("logo-remove").hidden = !branding.logo;

  const update = async (change: Partial<Branding>) => {
    Object.assign(branding, change);
    await saveBranding(branding);
    renderBranding(branding, true);
    $("logo-remove").hidden = !branding.logo;
  };

  $("agency-input").addEventListener("input", (e) => void update({ agencyName: (e.target as HTMLInputElement).value }));
  $("client-input").addEventListener("input", (e) => void update({ clientName: (e.target as HTMLInputElement).value }));
  $("date-input").addEventListener("input", (e) => void update({ date: (e.target as HTMLInputElement).value }));
  $("logo-remove").addEventListener("click", () => void update({ logo: "" }));
  $("logo-input").addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    $("logo-error").textContent = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) $("logo-error").textContent = "Choose an image file (PNG, JPG, SVG…).";
    else if (file.size > MAX_LOGO_BYTES) $("logo-error").textContent = "That logo is over 1 MB. Choose a smaller image.";
    else await update({ logo: await readFileAsDataUrl(file) });
    input.value = "";
  });
}

async function main() {
  renderNav($("nav"), "report");
  const audit = await loadAudit();
  if (!audit) {
    $("empty").hidden = false;
    return;
  }

  $("page").textContent = audit.title ? `${audit.title} (${audit.url})` : audit.url;
  renderScore($("score"), audit.score);
  renderCounts($("counts"), audit.issues);
  renderIssueList($("issues"), audit.issues, { open: true });

  const pro = await isPro();
  const branding = await getBranding();
  if (pro) setupBrandingPanel(branding);
  else renderUpgradePrompt($("branding-locked"), "Branded reports (logo, agency and client name)");
  renderBranding(branding, pro);

  $("content").hidden = false;
  $("print").addEventListener("click", () => window.print());
  // Expand every issue so nothing is hidden in the PDF.
  window.addEventListener("beforeprint", () => document.querySelectorAll("details").forEach((d) => (d.open = true)));
}

void main();
