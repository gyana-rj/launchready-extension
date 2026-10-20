import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config";
import { addAudit, clearHistory, getAudit, getHistory } from "../../src/history";
import type { ScanResult } from "../../src/types";
import { stubChromeStorage } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const scan = (n: number): ScanResult => ({ url: `https://example.com/${n}`, title: `Page ${n}`, scannedAt: n, score: 90, issues: [] });

describe("audit history", () => {
  it("saves audits newest first with unique ids", async () => {
    stubChromeStorage();
    const first = await addAudit(scan(1));
    const second = await addAudit(scan(2));
    expect(first.id).not.toBe(second.id);
    expect((await getHistory()).map((a) => a.url)).toEqual(["https://example.com/2", "https://example.com/1"]);
  });

  it("finds an audit by id", async () => {
    stubChromeStorage();
    const saved = await addAudit(scan(1));
    expect((await getAudit(saved.id))?.title).toBe("Page 1");
    expect(await getAudit("missing")).toBeUndefined();
  });

  it("keeps only the last 200 audits", async () => {
    stubChromeStorage();
    expect(config.historyLimit).toBe(200);
    for (let i = 1; i <= 205; i++) await addAudit(scan(i));
    const history = await getHistory();
    expect(history).toHaveLength(200);
    expect(history[0].url).toBe("https://example.com/205");
    expect(history.at(-1)?.url).toBe("https://example.com/6");
  });

  it("doesn't lose audits saved at the same time", async () => {
    stubChromeStorage();
    await Promise.all(Array.from({ length: 20 }, (_, i) => addAudit(scan(i))));
    expect(await getHistory()).toHaveLength(20);
  });

  it("clears the history", async () => {
    stubChromeStorage();
    await addAudit(scan(1));
    await clearHistory();
    expect(await getHistory()).toEqual([]);
  });
});
