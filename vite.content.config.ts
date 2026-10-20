import { defineConfig } from "vite";
import { resolve } from "node:path";

// The content script is injected with chrome.scripting.executeScript, so it must be a single
// classic script (IIFE) with no imports. Runs after the main build, into the same folder.
export default defineConfig(({ mode }) => ({
  publicDir: false, // the main build already copied public/ (and may have edited manifest.json)
  build: {
    outDir: mode === "e2e" ? "dist-e2e" : "dist",
    emptyOutDir: false,
    target: "es2022",
    lib: {
      entry: resolve(import.meta.dirname, "src/content/scan.ts"),
      formats: ["iife"],
      name: "LaunchReadyContent",
      fileName: () => "content.js",
    },
  },
}));
