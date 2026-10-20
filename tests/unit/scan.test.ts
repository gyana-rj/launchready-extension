import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeScanError } from "../../src/errors";
import { scanTab } from "../../src/scan";
import type { ScanResult } from "../../src/types";

const result: ScanResult = { url: "https://example.com/", title: "x", scannedAt: 1, score: 100, issues: [] };

function stubChrome(tabUrl: string | undefined, executeScript: (...args: unknown[]) => Promise<unknown>) {
  const run = vi.fn(executeScript);
  vi.stubGlobal("chrome", { tabs: { get: async () => ({ url: tabUrl }) }, scripting: { executeScript: run } });
  return run;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("scanTab", () => {
  it("injects the engine, then collects the result", async () => {
    const run = stubChrome("https://example.com/", async () => [{ result }]);
    await expect(scanTab(1)).resolves.toEqual(result);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it.each(["chrome://version", "https://chromewebstore.google.com/", "https://example.com/a.pdf"])("refuses %s without injecting", async (url) => {
    const run = stubChrome(url, async () => [{ result }]);
    const error = await scanTab(1).catch((e) => e);
    expect(describeScanError(error)).not.toContain("didn't finish");
    expect(run).not.toHaveBeenCalled();
  });

  it("still tries when the tab URL isn't visible, and explains a browser refusal", async () => {
    stubChrome(undefined, async () => {
      throw new Error("Cannot access a chrome:// URL");
    });
    expect(describeScanError(await scanTab(1).catch((e) => e))).toContain("Browser pages");
  });

  it("fails clearly when the page returns nothing", async () => {
    stubChrome("https://example.com/", async () => [{ result: undefined }]);
    await expect(scanTab(1)).rejects.toThrow();
  });

  it("gives up after 60 seconds", async () => {
    stubChrome("https://example.com/", () => new Promise(() => {}));
    const outcome = scanTab(1).catch((e) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(describeScanError(await outcome)).toContain("took too long");
  });
});
