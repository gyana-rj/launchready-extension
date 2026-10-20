import type { Check } from "../types";
import { findMeta, getHeader, isStagingHost, makeIssue, pageUrl, parseUrl, snippet, snippets, stripWww } from "../utils";

const NOINDEX = /(^|[\s,:])(noindex|none)(?=$|[\s,;])/i;

export const checkNoindex: Check = (doc, ctx) => {
  const metas = ["robots", "googlebot"]
    .map((name) => findMeta(doc, name))
    .filter((m): m is HTMLMetaElement => !!m && NOINDEX.test(m.getAttribute("content") ?? ""));
  const header = getHeader(ctx, "x-robots-tag");
  const headerHit = !!header && NOINDEX.test(header);
  if (!metas.length && !headerHit) return [];

  const elements = snippets(metas);
  if (headerHit) elements.push(`X-Robots-Tag: ${header}`);
  return [
    makeIssue(
      "noindex",
      "critical",
      "Page is blocked from search engines (noindex)",
      "A robots meta tag or X-Robots-Tag header tells search engines not to index this page, so it will not appear in search results.",
      'Remove the noindex directive from the <meta name="robots"> tag or from the X-Robots-Tag response header. Staging settings are often copied to production by mistake.',
      elements,
    ),
  ];
};

/** True when robots.txt has "Disallow: /" in a group that applies to all agents (*). */
export function robotsBlocksAll(text: string): boolean {
  let agents: string[] = [];
  let groupHasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.replace(/#.*/, "").trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (groupHasRules) {
        agents = [];
        groupHasRules = false;
      }
      agents.push(value.toLowerCase());
    } else if (key === "disallow" || key === "allow") {
      groupHasRules = true;
      if (key === "disallow" && value === "/" && agents.includes("*")) return true;
    }
  }
  return false;
}

export const checkRobotsTxt: Check = (_doc, ctx) => {
  if (!ctx.robotsTxt || !robotsBlocksAll(ctx.robotsTxt)) return [];
  return [
    makeIssue(
      "robots-txt-blocks-all",
      "critical",
      "robots.txt blocks all crawlers",
      'robots.txt contains "Disallow: /" for all user agents, which stops search engines from crawling the whole site.',
      'Edit robots.txt and remove "Disallow: /" under "User-agent: *" (or replace it with an empty "Disallow:") before launch.',
      ["User-agent: *", "Disallow: /"],
    ),
  ];
};

export const checkCanonical: Check = (doc, ctx) => {
  const link = doc.querySelector('link[rel~="canonical" i]');
  const href = link?.getAttribute("href")?.trim();
  if (!link || !href) return [];

  const base = pageUrl(doc, ctx);
  const canonical = parseUrl(href, base);
  if (!canonical) return [];

  let problem: string | undefined;
  if (isStagingHost(canonical.hostname)) {
    problem = `points to a local or staging domain (${canonical.hostname})`;
  } else if (base && stripWww(canonical.hostname) !== stripWww(new URL(base).hostname)) {
    problem = `points to a different host (${canonical.hostname})`;
  }
  if (!problem) return [];

  return [
    makeIssue(
      "canonical-bad-host",
      "critical",
      "Canonical URL points to the wrong site",
      `The canonical link ${problem}. Search engines may ignore this page in favour of that URL.`,
      "Set the canonical URL to this page's final public address on the production domain.",
      [snippet(link)],
    ),
  ];
};

const MIXED_CONTENT_SELECTOR = [
  "img[src]",
  "script[src]",
  "iframe[src]",
  "audio[src]",
  "video[src]",
  "source[src]",
  "embed[src]",
  'link[rel~="stylesheet" i][href]',
  "object[data]",
].join(",");

export const checkMixedContent: Check = (doc, ctx) => {
  const base = pageUrl(doc, ctx);
  if (!base?.startsWith("https:")) return [];

  const bad = Array.from(doc.querySelectorAll(MIXED_CONTENT_SELECTOR)).filter((el) => {
    const value = el.getAttribute("src") ?? el.getAttribute("href") ?? el.getAttribute("data") ?? "";
    return /^http:\/\//i.test(value.trim());
  });
  if (!bad.length) return [];

  return [
    makeIssue(
      "mixed-content",
      "critical",
      "Insecure (http) resources on an https page",
      `${bad.length} resource(s) load over http. Browsers block or warn about these, which can break images, scripts and styles.`,
      "Change each URL to https:// (or a protocol-relative path) and make sure the resource is available over https.",
      snippets(bad),
    ),
  ];
};

export const checkTitle: Check = (doc) => {
  const title = doc.querySelector("head > title") ?? doc.querySelector("title");
  if (title?.textContent?.trim()) return [];
  return [
    makeIssue(
      "missing-title",
      "critical",
      "Page has no <title>",
      title ? "The <title> element is empty." : "There is no <title> element in the page head.",
      "Add a unique, descriptive <title> (about 50-60 characters) inside <head>.",
    ),
  ];
};

export const criticalChecks: Check[] = [checkNoindex, checkRobotsTxt, checkCanonical, checkMixedContent, checkTitle];
