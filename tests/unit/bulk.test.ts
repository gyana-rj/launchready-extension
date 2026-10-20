import { describe, expect, it } from "vitest";
import { auditHtml, bulkScan, parseUrlList } from "../../src/bulk";
import { PAGE_URL, readFixture } from "./helpers";

describe("parseUrlList", () => {
  it("parses one URL per line, adds https to bare domains, drops blanks, duplicates and hashes", () => {
    const text = "https://a.com/x\n\n  b.com  \nhttp://c.com/#top\nhttps://a.com/x\nhttps://a.com/x#frag\nlocalhost:3000\r\n";
    expect(parseUrlList(text).urls).toEqual(["https://a.com/x", "https://b.com/", "http://c.com/", "https://localhost:3000/"]);
  });

  it("reports lines that aren't web addresses", () => {
    const { urls, invalid } = parseUrlList("ftp://a.com\nnot a url\nmailto:x@y.z\nhttps://ok.com");
    expect(urls).toEqual(["https://ok.com/"]);
    expect(invalid).toEqual(["ftp://a.com", "not a url", "mailto:x@y.z"]);
  });

  it("rejects text with spaces and single words (browsers would otherwise accept them as hosts)", () => {
    const { urls, invalid } = parseUrlList("not a url\nhello\nhttps://two words.com\nhttp://[::1]:8080/\n10.0.0.1");
    expect(urls).toEqual(["http://[::1]:8080/", "https://10.0.0.1/"]);
    expect(invalid).toEqual(["not a url", "hello", "https://two words.com"]);
  });

  it("keeps the first 50 and counts the rest as ignored", () => {
    const text = Array.from({ length: 57 }, (_, i) => `https://site${i}.com`).join("\n");
    const result = parseUrlList(text);
    expect(result.urls).toHaveLength(50);
    expect(result.urls[49]).toBe("https://site49.com/");
    expect(result.ignored).toBe(7);
  });
});

describe("auditHtml", () => {
  it("audits raw HTML with the given URL and headers", () => {
    const result = auditHtml(readFixture("noindex.bad.html"), PAGE_URL, {});
    expect(result.url).toBe(PAGE_URL);
    expect(result.title).toBe("Acme Plumbing | Emergency Plumbers in Austin");
    expect(result.score).toBe(85);
    expect(result.issues.map((i) => i.id)).toContain("noindex");
  });
  it("uses response headers and robots.txt", () => {
    const result = auditHtml(readFixture("good.html"), PAGE_URL, { "x-robots-tag": "noindex" }, "User-agent: *\nDisallow: /");
    expect(result.issues.map((i) => i.id)).toEqual(expect.arrayContaining(["noindex", "robots-txt-blocks-all"]));
  });
});

describe("bulkScan", () => {
  const pages: Record<string, () => Response> = {
    "https://a.com/": () => new Response(readFixture("good.html"), { headers: { "content-type": "text/html" } }),
    "https://b.com/": () => new Response(readFixture("noindex.bad.html"), { headers: { "content-type": "text/html; charset=utf-8" } }),
    "https://c.com/": () => new Response("nope", { status: 404 }),
    "https://d.com/": () => new Response("{}", { headers: { "content-type": "application/json" } }),
    "https://a.com/robots.txt": () => new Response("User-agent: *\nDisallow: /"),
  };
  const fetcher = async (url: string) => {
    if (url.includes("down.com")) throw new TypeError("network");
    return pages[url]?.() ?? new Response("", { status: 404 });
  };

  it("scans each URL in order and reports failures per row", async () => {
    const seen: number[] = [];
    const rows = await bulkScan(["https://a.com/", "https://b.com/", "https://c.com/", "https://d.com/", "https://down.com/"], {
      fetcher,
      onRow: (_row, done) => seen.push(done),
    });
    expect(rows.map((r) => r.url)).toEqual(["https://a.com/", "https://b.com/", "https://c.com/", "https://d.com/", "https://down.com/"]);
    expect(rows[0].result?.score).toBeLessThan(100); // fixture canonical is another host
    expect(rows[1].result?.issues.map((i) => i.id)).toContain("noindex");
    expect(rows[2].error).toBe("HTTP 404");
    expect(rows[3].error).toBe("Not an HTML page");
    expect(rows[4].error).toBe("Could not load the page");
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("fetches robots.txt once per site and feeds it to the audit", async () => {
    let robotsFetches = 0;
    const counting = async (url: string) => {
      if (url.endsWith("/robots.txt")) robotsFetches++;
      return fetcher(url);
    };
    const rows = await bulkScan(["https://a.com/", "https://a.com/"], { fetcher: counting });
    expect(robotsFetches).toBe(1);
    expect(rows[0].result?.issues.map((i) => i.id)).toContain("robots-txt-blocks-all");
  });

  it("returns no rows for no URLs", async () => {
    expect(await bulkScan([], { fetcher })).toEqual([]);
  });
});
