import { describe, expect, it } from "vitest";
import { checkLinks, getSameOriginLinks, runAudit } from "../../src/engine";
import { PAGE_URL, ctx, loadFixture } from "./helpers";

/** Fake server: HEAD is rejected with 405 (forcing the GET fallback); /missing-page is a 404. */
const fakeFetch = async (url: string, init?: RequestInit) => {
  if (init?.method === "HEAD") return { status: 405, ok: false };
  if (url.endsWith("/missing-page")) return { status: 404, ok: false };
  if (url.endsWith("/down")) throw new Error("network");
  return { status: 200, ok: true };
};

describe("getSameOriginLinks", () => {
  it("returns unique same-origin http(s) links without hashes", () => {
    const html = `<a href="/a#x">1</a><a href="/a">2</a><a href="#top">3</a><a href="mailto:x@y.z">4</a>
      <a href="https://other.com/">5</a><a href="${PAGE_URL}b">6</a><a href="">7</a>`;
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(getSameOriginLinks(doc, PAGE_URL)).toEqual([`${PAGE_URL}a`, `${PAGE_URL}b`]);
  });
  it("stops at the limit", () => {
    const html = Array.from({ length: 80 }, (_, i) => `<a href="/p${i}">x</a>`).join("");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(getSameOriginLinks(doc, PAGE_URL)).toHaveLength(50);
    expect(getSameOriginLinks(doc, PAGE_URL, 5)).toHaveLength(5);
  });
});

describe("checkLinks", () => {
  it("falls back from HEAD to GET and records 0 when nothing responds", async () => {
    const results = await checkLinks([`${PAGE_URL}ok`, `${PAGE_URL}missing-page`, `${PAGE_URL}down`], fakeFetch);
    expect(results).toEqual({ [`${PAGE_URL}ok`]: 200, [`${PAGE_URL}missing-page`]: 404, [`${PAGE_URL}down`]: 0 });
  });
  it("trusts a successful HEAD without a GET", async () => {
    const methods: string[] = [];
    await checkLinks([`${PAGE_URL}ok`], async (_url, init) => {
      methods.push(init?.method ?? "");
      return { status: 200, ok: true };
    });
    expect(methods).toEqual(["HEAD"]);
  });
});

describe("broken-links check", () => {
  it("bad page: reports the broken same-origin link only", async () => {
    const doc = loadFixture("broken-links.bad.html");
    const linkResults = await checkLinks(getSameOriginLinks(doc, PAGE_URL), fakeFetch);
    const issues = runAudit(doc, { ...ctx, linkResults }).issues.filter((i) => i.severity !== "info");
    expect(issues.map((i) => i.id)).toEqual(["broken-links"]);
    expect(issues[0].elements).toEqual([`${PAGE_URL}missing-page (404)`]);
  });
  it("good page: no issue", async () => {
    const doc = loadFixture("broken-links.good.html");
    const linkResults = await checkLinks(getSameOriginLinks(doc, PAGE_URL), fakeFetch);
    expect(runAudit(doc, { ...ctx, linkResults }).issues.map((i) => i.id)).toEqual(["page-stats"]);
  });
  it("is skipped when no link results are supplied", () => {
    const issues = runAudit(loadFixture("broken-links.bad.html"), ctx).issues;
    expect(issues.some((i) => i.id === "broken-links")).toBe(false);
  });
});
