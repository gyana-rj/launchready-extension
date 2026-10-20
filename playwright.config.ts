import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1, // extension tests share one browser profile style; keep serial
  reporter: "list",
  // Local static server for the HTML fixtures.
  webServer: {
    command: "node tests/e2e/static-server.mjs",
    url: "http://127.0.0.1:4173/good.html",
    reuseExistingServer: true,
  },
});
