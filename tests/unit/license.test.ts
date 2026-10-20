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

describe("beta mode and the test key (build flags)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** Loads a fresh copy of the license module under the given build flags. */
  async function licenseWith(flags: { beta?: string; testKey?: string }) {
    vi.stubEnv("VITE_BETA_MODE", flags.beta as string);
    vi.stubEnv("VITE_ENABLE_TEST_KEY", flags.testKey as string);
    vi.resetModules();
    stubChromeStorage();
    return import("../../src/license");
  }

  it("beta mode makes everyone Pro, with no key", async () => {
    const { isPro } = await licenseWith({ beta: "true" });
    expect(await isPro()).toBe(true);
  });

  it("beta mode is the default when the flag isn't set (production builds)", async () => {
    const { isPro } = await licenseWith({ beta: undefined });
    expect(await isPro()).toBe(true);
  });

  it("with beta off, users are Free until they activate", async () => {
    const { isPro } = await licenseWith({ beta: "false", testKey: "true" });
    expect(await isPro()).toBe(false);
  });

  it("without the test-key flag (production), TEST-PRO is rejected", async () => {
    const { activate, isPro } = await licenseWith({ beta: "false", testKey: undefined });
    expect((await activate("TEST-PRO")).ok).toBe(false);
    expect(await isPro()).toBe(false);
  });
});
