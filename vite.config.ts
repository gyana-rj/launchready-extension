import { defineConfig, type Plugin } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** E2E build only: lets the test pages (fake *.acme-plumbing.test domain) be scanned without a user click on the toolbar. */
function e2eManifest(): Plugin {
  return {
    name: "e2e-manifest",
    writeBundle(options) {
      const file = resolve(options.dir!, "manifest.json");
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      manifest.host_permissions = ["http://*.acme-plumbing.test/*"];
      writeFileSync(file, JSON.stringify(manifest, null, 2));
    },
  };
}

// Multi-entry build: popup + report pages, and the background service worker
// (fixed filename so manifest.json can reference it). The content script is built by vite.content.config.ts.
// `vite build --mode e2e` (and `e2e-beta`) write to dist-<mode> with the extra test permission.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode.startsWith("e2e") ? [e2eManifest()] : [],
  build: {
    outDir: mode.startsWith("e2e") ? `dist-${mode}` : "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "src/popup/popup.html"),
        report: resolve(import.meta.dirname, "src/report/report.html"),
        settings: resolve(import.meta.dirname, "src/settings/settings.html"),
        history: resolve(import.meta.dirname, "src/history/history.html"),
        bulk: resolve(import.meta.dirname, "src/bulk/bulk.html"),
        privacy: resolve(import.meta.dirname, "src/privacy/privacy.html"),
        background: resolve(import.meta.dirname, "src/background/index.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
}));
