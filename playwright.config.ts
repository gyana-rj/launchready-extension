import { defineConfig } from "@playwright/test";
import type { ExtensionOptions } from "./tests/e2e/fixtures";

export default defineConfig<ExtensionOptions>({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1, // extension tests share one browser profile style; keep serial
  reporter: "list",
  // Two builds of the extension: Free/Pro tiers (beta off, test key on) and the free beta (as shipped).
  projects: [
    { name: "tiers", testIgnore: /beta\.spec/, use: { extensionDir: "dist-e2e" } },
    { name: "beta", testMatch: /beta\.spec/, use: { extensionDir: "dist-e2e-beta" } },
  ],
  // Local static server for the HTML fixtures.
  webServer: {
    command: "node tests/e2e/static-server.mjs",
    url: "http://127.0.0.1:4173/good.html",
    reuseExistingServer: true,
  },
});
