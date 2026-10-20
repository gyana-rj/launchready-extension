import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../src/config";
import { getRemainingScans, recordScan } from "../../src/limits";
import { stubChromeStorage } from "./helpers";

describe("daily scan limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts with the full allowance", async () => {
    stubChromeStorage();
    expect(await getRemainingScans()).toBe(config.freeScansPerDay);
  });

  it("counts each recorded scan down to zero and no further", async () => {
    stubChromeStorage();
    for (let i = 1; i <= config.freeScansPerDay + 2; i++) await recordScan();
    expect(await getRemainingScans()).toBe(0);
  });

  it("resets on a new local day", async () => {
    stubChromeStorage();
    for (let i = 0; i < config.freeScansPerDay; i++) await recordScan();
    expect(await getRemainingScans()).toBe(0);

    vi.setSystemTime(new Date(2026, 5, 16, 0, 0, 1));
    expect(await getRemainingScans()).toBe(config.freeScansPerDay);
  });

  it("stores the count in chrome.storage.local", async () => {
    const data = stubChromeStorage();
    await recordScan();
    expect(data.scanUsage).toEqual({ date: "2026-06-15", count: 1 });
  });
});
