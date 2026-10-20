import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-entry build: popup + report pages, and the background service worker
// (fixed filename so manifest.json can reference it).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "src/popup/popup.html"),
        report: resolve(import.meta.dirname, "src/report/report.html"),
        background: resolve(import.meta.dirname, "src/background/index.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
