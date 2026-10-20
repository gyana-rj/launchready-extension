import type { Issue, Severity } from "../types";
import type { AuditContext } from "./types";

const MAX_ELEMENTS = 10;

export function makeIssue(
  id: string,
  severity: Severity,
  title: string,
  description: string,
  howToFix: string,
  elements: string[] = [],
): Issue {
  return { id, severity, title, description, howToFix, elements: elements.slice(0, MAX_ELEMENTS) };
}

/** Short one-line HTML snippet of an element. */
export function snippet(el: Element, max = 120): string {
  const html = el.outerHTML.replace(/\s+/g, " ");
  return html.length > max ? html.slice(0, max - 1) + "…" : html;
}

export function snippets(els: Iterable<Element>): string[] {
  return Array.from(els).slice(0, MAX_ELEMENTS).map((el) => snippet(el));
}

export function pageUrl(doc: Document, ctx: AuditContext): string | undefined {
  return ctx.url ?? (/^https?:/.test(doc.URL) ? doc.URL : undefined);
}

export function parseUrl(value: string, base?: string): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

export function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** localhost, or a staging-looking host (staging./dev./test. subdomains, vercel/netlify/pages.dev). */
export function isStagingHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    /(^|\.)(staging|dev|test)\.[^.]+\.[^.]+/.test(h) ||
    /\.(vercel\.app|netlify\.app|pages\.dev)$/.test(h)
  );
}

export function getHeader(ctx: AuditContext, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const key = Object.keys(ctx.headers ?? {}).find((k) => k.toLowerCase() === wanted);
  return key ? ctx.headers![key] : undefined;
}

/** Finds <meta name="key"> or <meta property="key"> (case-insensitive). */
export function findMeta(doc: Document, key: string): HTMLMetaElement | undefined {
  return Array.from(doc.querySelectorAll("meta")).find((m) =>
    ["name", "property"].some((attr) => m.getAttribute(attr)?.toLowerCase() === key),
  );
}

/** Text a visitor can read: body text without script/style/noscript/template. */
export function visibleText(doc: Document): string {
  const body = (doc.body ?? doc.documentElement).cloneNode(true) as Element;
  body.querySelectorAll("script, style, noscript, template").forEach((el) => el.remove());
  return body.textContent ?? "";
}
