import { afterEach, describe, expect, it, vi } from "vitest";
import { collectScan } from "../../src/content/collect";
import { PAGE_URL, loadFixture } from "./helpers";

type Handler = () => Response | Promise<Response>;

/** Fake network keyed by "METHOD url" or just "url". Anything unlisted answers 200. */
const network = (handlers: Record<string, Handler> = {}) => async (url: string, init?: RequestInit) => {
  const handler = handlers[`${init?.method ?? "GET"} ${url}`] ?? handlers[url];
  return handler ? handler() : new Response("", { status: 200 });
};

afterEach(() => vi.useRealTimers());

describe("collectScan", () => {
  const doc = () => loadFixture("good.html");

  it("scans cleanly when everything is reachable", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}robots.txt`]: () => new Response("User-agent: *\nDisallow:") }));
    expect(result.score).toBe(100);
    expect(result.skipped).toBeUndefined();
  });

  it("reads response headers", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`HEAD ${PAGE_URL}`]: () => new Response("", { headers: { "X-Robots-Tag": "noindex" } }) }));
    expect(result.issues.map((i) => i.id)).toContain("noindex");
  });

  it("notes when the page's headers couldn't be fetched, but still scans", async () => {
    const down = () => {
      throw new TypeError("network");
    };
    const result = await collectScan(doc(), PAGE_URL, network({ [`HEAD ${PAGE_URL}`]: down, [`GET ${PAGE_URL}`]: down }));
    expect(result.skipped).toEqual([expect.stringContaining("response headers")]);
    expect(result.issues.map((i) => i.id)).toContain("page-stats"); // the scan still ran
  });

  it("treats a missing robots.txt (404) as normal", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}robots.txt`]: () => new Response("", { status: 404 }) }));
    expect(result.skipped).toBeUndefined();
  });

  it.each([500, 503, 429])("notes a robots.txt that answers %i", async (status) => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}robots.txt`]: () => new Response("", { status }) }));
    expect(result.skipped).toEqual([expect.stringContaining("robots.txt")]);
  });

  it("notes a robots.txt that can't be reached", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}robots.txt`]: () => Promise.reject(new TypeError("network")) }));
    expect(result.skipped).toEqual([expect.stringContaining("robots.txt")]);
  });

  it("uses robots.txt when present", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}robots.txt`]: () => new Response("User-agent: *\nDisallow: /") }));
    expect(result.issues.map((i) => i.id)).toContain("robots-txt-blocks-all");
  });

  it("reports broken links", async () => {
    const result = await collectScan(doc(), PAGE_URL, network({ [`${PAGE_URL}services`]: () => new Response("", { status: 404 }) }));
    expect(result.issues.find((i) => i.id === "broken-links")?.elements).toEqual([`${PAGE_URL}services (404)`]);
  });

  it("skips the link check if it takes too long, instead of hanging the scan", async () => {
    vi.useFakeTimers();
    const hang = () => new Promise<Response>(() => {});
    const pending = collectScan(doc(), PAGE_URL, network({ [`HEAD ${PAGE_URL}services`]: hang, [`HEAD ${PAGE_URL}contact`]: hang, [`HEAD ${PAGE_URL}`]: () => new Response("") }));
    // The page itself is the only link-check target that answers; the rest never do.
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await pending;
    expect(result.skipped).toEqual([expect.stringContaining("broken-link check")]);
    expect(result.issues.some((i) => i.id === "broken-links")).toBe(false);
  });
});
