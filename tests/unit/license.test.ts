import { afterEach, describe, expect, it, vi } from "vitest";
import { activate, deactivate, isPro } from "../../src/license";
import { stubChromeStorage } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("license stub", () => {
  it("is not Pro by default", async () => {
    stubChromeStorage();
    expect(await isPro()).toBe(false);
  });

  it("TEST-PRO activates Pro", async () => {
    stubChromeStorage();
    expect(await activate("TEST-PRO")).toEqual({ ok: true });
    expect(await isPro()).toBe(true);
  });

  it("ignores case and surrounding spaces", async () => {
    stubChromeStorage();
    expect((await activate("  test-pro ")).ok).toBe(true);
    expect(await isPro()).toBe(true);
  });

  it("rejects wrong and empty keys without changing the plan", async () => {
    stubChromeStorage();
    expect(await activate("nope")).toEqual({ ok: false, error: expect.stringContaining("isn't valid") });
    expect(await activate("   ")).toEqual({ ok: false, error: "Enter a license key." });
    expect(await isPro()).toBe(false);
  });

  it("does not trust an unknown key found in storage", async () => {
    stubChromeStorage({ license: { key: "FORGED", activatedAt: 1 } });
    expect(await isPro()).toBe(false);
  });

  it("deactivate returns to Free", async () => {
    stubChromeStorage();
    await activate("TEST-PRO");
    await deactivate();
    expect(await isPro()).toBe(false);
  });
});
