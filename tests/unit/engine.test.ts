import { describe, expect, it } from "vitest";
import { calculateScore, runAudit, type AuditContext } from "../../src/engine";
import type { Issue } from "../../src/types";
import { ctx, loadFixture, parse, readFixture } from "./helpers";

/** Ids of non-info issues, which is what a fixture is meant to trigger. */
const problemIds = (doc: Document, context: AuditContext = ctx) =>
  runAudit(doc, context)
    .issues.filter((i) => i.severity !== "info")
    .map((i) => i.id);

// One entry per fixture pair: tests/fixtures/<name>.bad.html triggers exactly `ids`;
// tests/fixtures/<name>.good.html triggers nothing.
const fixtureCases: [name: string, ids: string[]][] = [
  ["noindex", ["noindex"]],
  ["canonical-bad-host", ["canonical-bad-host"]],
  ["mixed-content", ["mixed-content"]],
  ["missing-title", ["missing-title"]],
  ["meta-description-missing", ["meta-description-missing"]],
  ["meta-description-short", ["meta-description-short"]],
  ["meta-description-long", ["meta-description-long"]],
  ["h1-missing", ["h1-missing"]],
  ["h1-multiple", ["h1-multiple"]],
  ["heading-skip", ["heading-skip"]],
  ["img-alt-missing", ["img-alt-missing"]],
  ["og-missing", ["og-title-missing", "og-description-missing", "og-image-missing"]],
  ["og-staging-url", ["og-staging-url"]],
  ["placeholder-text", ["placeholder-text"]],
  ["favicon-missing", ["favicon-missing"]],
  ["viewport-missing", ["viewport-missing"]],
  ["html-lang-missing", ["html-lang-missing"]],
  ["empty-links", ["empty-links"]],
];

describe.each(fixtureCases)("fixture: %s", (name, ids) => {
  it("bad page triggers the check", () => {
    expect(problemIds(loadFixture(`${name}.bad.html`))).toEqual(ids);
  });
  it("good page does not", () => {
    expect(problemIds(loadFixture(`${name}.good.html`))).toEqual([]);
  });
});

describe("baseline page", () => {
  it("passes every check and scores 100", () => {
    const result = runAudit(loadFixture("good.html"), ctx);
    expect(result.issues.map((i) => i.id)).toEqual(["page-stats"]);
    expect(result.score).toBe(100);
  });
});

describe("noindex", () => {
  const good = loadFixture("good.html");
  it("detects X-Robots-Tag noindex from headers", () => {
    const issues = runAudit(good, { ...ctx, headers: { "X-Robots-Tag": "noindex, nofollow" } }).issues;
    expect(issues.find((i) => i.id === "noindex")?.elements).toEqual(["X-Robots-Tag: noindex, nofollow"]);
  });
  it("ignores other X-Robots-Tag values", () => {
    expect(problemIds(good, { ...ctx, headers: { "x-robots-tag": "nosnippet" } })).toEqual([]);
  });
  it('treats "none" and googlebot-specific meta as noindex', () => {
    const html = readFixture("noindex.good.html").replace('name="robots" content="index, follow"', 'name="googlebot" content="none"');
    expect(problemIds(parse(html))).toEqual(["noindex"]);
  });
});

describe("robots.txt", () => {
  it("flags Disallow: / for all agents", () => {
    const doc = loadFixture("good.html");
    expect(problemIds(doc, { ...ctx, robotsTxt: readFixture("robots-txt-blocks-all.bad.txt") })).toEqual(["robots-txt-blocks-all"]);
  });
  it("passes a normal robots.txt", () => {
    const doc = loadFixture("good.html");
    expect(problemIds(doc, { ...ctx, robotsTxt: readFixture("robots-txt-blocks-all.good.txt") })).toEqual([]);
  });
  it("only counts groups that apply to all agents", () => {
    const doc = loadFixture("good.html");
    const robotsTxt = "User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n";
    expect(problemIds(doc, { ...ctx, robotsTxt })).toEqual([]);
  });
  it("handles shared groups, comments and Windows line endings", () => {
    const doc = loadFixture("good.html");
    const robotsTxt = "User-agent: Googlebot\r\nUser-agent: *\r\nDisallow: / # temporary\r\n";
    expect(problemIds(doc, { ...ctx, robotsTxt })).toEqual(["robots-txt-blocks-all"]);
  });
  it("is skipped when no robots.txt is provided", () => {
    expect(problemIds(loadFixture("good.html"))).toEqual([]);
  });
});

describe("canonical", () => {
  const withCanonical = (href: string) =>
    parse(readFixture("canonical-bad-host.good.html").replace("https://acme-plumbing.com/", href));
  it.each([
    "http://localhost:3000/",
    "https://other-site.com/",
    "https://myapp.vercel.app/",
    "https://myapp.netlify.app/",
    "https://myapp.pages.dev/",
    "https://dev.acme-plumbing.com/",
    "https://test.acme-plumbing.com/",
  ])("flags %s", (href) => {
    expect(problemIds(withCanonical(href))).toEqual(["canonical-bad-host"]);
  });
  it("accepts www and non-www of the same host, and relative canonicals", () => {
    expect(problemIds(withCanonical("https://acme-plumbing.com/page"))).toEqual([]);
    expect(problemIds(withCanonical("/page"))).toEqual([]);
  });
  it("does not treat a short real domain like dev.to as staging", () => {
    expect(problemIds(withCanonical("https://dev.to/"), { url: "https://dev.to/" })).toEqual([]);
  });
});

describe("mixed content", () => {
  it("is not reported on http pages", () => {
    expect(problemIds(loadFixture("mixed-content.bad.html"), { url: "http://www.acme-plumbing.com/" })).toEqual([]);
  });
  it("lists the offending elements", () => {
    const issue = runAudit(loadFixture("mixed-content.bad.html"), ctx).issues.find((i) => i.id === "mixed-content")!;
    expect(issue.elements).toHaveLength(2);
    expect(issue.elements.join("\n")).toContain("http://cdn.acme-plumbing.com/app.js");
  });
});

describe("title", () => {
  it("flags an empty <title>", () => {
    const html = readFixture("missing-title.good.html").replace(/<title>.*<\/title>/, "<title>  </title>");
    expect(problemIds(parse(html))).toEqual(["missing-title"]);
  });
});

describe("images and elements list", () => {
  it("caps elements at 10", () => {
    const imgs = Array.from({ length: 25 }, (_, i) => `<img src="/${i}.jpg">`).join("");
    const html = readFixture("img-alt-missing.good.html").replace("</main>", `${imgs}</main>`);
    const issue = runAudit(parse(html), ctx).issues.find((i) => i.id === "img-alt-missing")!;
    expect(issue.elements).toHaveLength(10);
    expect(issue.description).toContain("25");
  });
});

describe("page stats (info)", () => {
  it("counts words, links and images, ignoring scripts", () => {
    const stats = runAudit(loadFixture("page-stats.html"), ctx).issues.find((i) => i.id === "page-stats")!;
    expect(stats.severity).toBe("info");
    expect(stats.description).toBe("13 words, 3 links, 2 images.");
  });
});

describe("score", () => {
  const make = (severity: Issue["severity"]): Issue => ({ id: severity, severity, title: "", description: "", howToFix: "", elements: [] });
  it("costs more for critical than warning, and nothing for info", () => {
    expect(calculateScore([])).toBe(100);
    expect(calculateScore([make("info"), make("info")])).toBe(100);
    expect(calculateScore([make("warning")])).toBe(95);
    expect(calculateScore([make("critical")])).toBe(85);
  });
  it("never goes below 0", () => {
    expect(calculateScore(Array.from({ length: 20 }, () => make("critical")))).toBe(0);
  });
  it("is lower for a page with problems", () => {
    expect(runAudit(loadFixture("noindex.bad.html"), ctx).score).toBe(85);
    expect(runAudit(loadFixture("og-missing.bad.html"), ctx).score).toBe(85);
  });
  it("returns issues ordered critical, warning, info", () => {
    const html = readFixture("noindex.bad.html").replace('<html lang="en">', "<html>");
    const severities = runAudit(parse(html), ctx).issues.map((i) => i.severity);
    expect(severities).toEqual(["critical", "warning", "info"]);
  });
});

describe("every issue is well formed", () => {
  it("has all fields, for a page that triggers many checks", () => {
    const html = readFixture("og-missing.bad.html")
      .replace('<html lang="en">', "<html>")
      .replace(/<title>.*<\/title>/, "")
      .replace('content="width=device-width, initial-scale=1"', 'content=""');
    const issues = runAudit(parse(html), ctx).issues;
    expect(issues.length).toBeGreaterThan(5);
    for (const issue of issues) {
      expect(issue.id).toBeTruthy();
      expect(["critical", "warning", "info"]).toContain(issue.severity);
      expect(issue.title).toBeTruthy();
      expect(issue.description).toBeTruthy();
      expect(issue.howToFix).toBeTruthy();
      expect(issue.elements.length).toBeLessThanOrEqual(10);
    }
  });
});
