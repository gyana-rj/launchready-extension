import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.json"), "utf8"));
const SIZES = [16, 32, 48, 128];

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): [number, number] {
  const data = readFileSync(file);
  expect(data.subarray(1, 4).toString()).toBe("PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

describe("icons", () => {
  it.each(SIZES)("icon-%i.png exists and is exactly that size", (size) => {
    expect(pngSize(resolve(root, `public/icons/icon-${size}.png`))).toEqual([size, size]);
  });

  it("the manifest uses all sizes for the extension and the toolbar", () => {
    for (const set of [manifest.icons, manifest.action.default_icon]) {
      expect(Object.keys(set).sort((a, b) => Number(a) - Number(b))).toEqual(SIZES.map(String));
      for (const path of Object.values(set) as string[]) expect(existsSync(resolve(root, "public", path))).toBe(true);
    }
  });
});

describe("store metadata", () => {
  it("fits Chrome Web Store limits", () => {
    expect(manifest.name.length).toBeLessThanOrEqual(45);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it("STORE_LISTING.md has the manifest's short description and the required sections", () => {
    const listing = readFileSync(resolve(root, "STORE_LISTING.md"), "utf8");
    expect(listing).toContain(manifest.description);
    for (const heading of ["### Short description", "### Full description", "### Feature list", "Permission justifications", "Privacy policy URL"]) {
      expect(listing).toContain(heading);
    }
    for (const permission of [...manifest.permissions, "optional host permissions"]) expect(listing.toLowerCase()).toContain(permission.toLowerCase());
  });

  it("asks only for minimal permissions", () => {
    expect(manifest.permissions.sort()).toEqual(["activeTab", "scripting", "storage"]);
    expect(manifest.host_permissions).toBeUndefined();
  });
});

describe("privacy policy page", () => {
  const html = readFileSync(resolve(root, "src/privacy/privacy.html"), "utf8");

  it("states that no data leaves the browser", () => {
    expect(html).toContain("No data leaves your browser");
  });

  it("is self-contained: no scripts and no external resources", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/(src|href)="https?:/i);
  });
});
