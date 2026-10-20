import { config } from "../config";
import { el } from "./render";

export const PAGES = {
  settings: "src/settings/settings.html",
  history: "src/history/history.html",
  bulk: "src/bulk/bulk.html",
  report: "src/report/report.html",
  privacy: "src/privacy/privacy.html",
} as const;

export function pageUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

export function openPage(path: string): void {
  void chrome.tabs.create({ url: pageUrl(path) });
}

/** "$9/month · $79/year · $149 one-time", from config. */
export function pricingText(): string {
  const { currency, monthly, yearly, lifetime } = config.pricing;
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return `${money(monthly)}/month · ${money(yearly)}/year · ${money(lifetime)} one-time`;
}

/** Shown in place of a Pro feature for free users. */
export function renderUpgradePrompt(container: HTMLElement, feature: string): void {
  const link = el("a", "button", "Upgrade to Pro");
  link.href = pageUrl(PAGES.settings);
  const box = el("section", "upgrade");
  box.append(
    el("h2", undefined, `${feature} is a Pro feature`),
    el("p", undefined, "Pro gives you unlimited scans, audit history, CSV export, branded client reports and bulk scanning."),
    el("p", "muted", pricingText()),
    link,
  );
  container.replaceChildren(box);
}

/** Top navigation shared by the full-page views. */
export function renderNav(container: HTMLElement, current: keyof typeof PAGES): void {
  const items: [keyof typeof PAGES, string][] = [
    ["history", "History"],
    ["bulk", "Bulk scan"],
    ["settings", "Settings"],
    ["privacy", "Privacy"],
  ];
  container.className = "nav no-print";
  container.replaceChildren(
    el("strong", undefined, "LaunchReady"),
    ...items.map(([page, label]) => {
      const link = el("a", undefined, label);
      link.href = pageUrl(PAGES[page]);
      if (page === current) link.setAttribute("aria-current", "page");
      return link;
    }),
  );
}
