// @vitest-environment node
// Builds the extension for real and inspects the output, so a release can't ship test-only code.
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const root = resolve(import.meta.dirname, "../..");

/** Builds the pages and the content script like `npm run build` does, in the given mode. */
async function buildExtension(mode: string): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), `lr-${mode}-`));
  for (const [configFile, emptyOutDir] of [["vite.config.ts", true], ["vite.content.config.ts", false]] as const) {
    await build({ root, configFile: resolve(root, configFile), mode, logLevel: "silent", build: { outDir, emptyOutDir } });
  }
  return outDir;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const textOf = (dir: string) => files(dir).filter((f) => /\.(js|html|css|json)$/.test(f)).map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

describe("production bundle", () => {
  let production: string;
  let e2e: string;
  beforeAll(async () => {
    // Vitest copies .env.test into process.env, and Vite lets process.env beat the .env.<mode> files.
    // Clear the build flags so each mode is built with only its own settings, as on a normal build.
    vi.stubEnv("VITE_BETA_MODE", undefined as unknown as string);
    vi.stubEnv("VITE_ENABLE_TEST_KEY", undefined as unknown as string);
    production = await buildExtension("production");
    e2e = await buildExtension("e2e");
  }, 120_000);
  afterAll(() => vi.unstubAllEnvs());

  it('does not contain the "TEST-PRO" test key anywhere', () => {
    const leaks = textOf(production).filter(({ text }) => text.includes("TEST-PRO")).map(({ file }) => file);
    expect(leaks).toEqual([]);
  });

  it("the check is meaningful: the e2e build does contain the test key", () => {
    expect(textOf(e2e).some(({ text }) => text.includes("TEST-PRO"))).toBe(true);
  });

  it("ships in free beta mode: the beta label is built in and the PRO badge is not", () => {
    const code = textOf(production).filter(({ file }) => file.endsWith(".js"));
    expect(code.some(({ text }) => text.includes("Free during beta"))).toBe(true);
    expect(code.some(({ text }) => text.includes('"PRO"'))).toBe(false);
  });

  it("has no test-only permissions, unlike the e2e build", () => {
    const manifest = (dir: string) => JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    expect(manifest(production).host_permissions).toBeUndefined();
    expect(manifest(production).permissions.sort()).toEqual(["activeTab", "scripting", "storage"]);
    expect(manifest(e2e).host_permissions).toBeDefined();
  });

  it("has no source maps and no remote code", () => {
    expect(files(production).filter((f) => f.endsWith(".map"))).toEqual([]);
    for (const { file, text } of textOf(production).filter(({ file }) => file.endsWith(".js"))) {
      expect(text, file).not.toMatch(/\beval\(|new Function\(|importScripts\(/);
    }
  });
});
