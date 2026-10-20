import { describe, expect, it } from "vitest";
import { describeScanError, explainUnscannable, ScanTimeoutError, UnscannableError } from "../../src/errors";

describe("explainUnscannable (tab URL known up front)", () => {
  it.each([
    "chrome://extensions",
    "chrome://newtab/",
    "chrome-extension://abc/page.html",
    "chrome-error://chromewebdata/",
    "edge://settings",
    "about:blank",
    "view-source:https://example.com",
    "devtools://devtools/bundled/inspector.html",
  ])("browser page: %s", (url) => {
    expect(explainUnscannable(url)).toContain("Browser pages");
  });

  it.each([
    "https://chromewebstore.google.com/detail/foo/abc",
    "https://chrome.google.com/webstore/detail/foo/abc",
    "https://microsoftedge.microsoft.com/addons/detail/foo",
  ])("web store: %s", (url) => {
    expect(explainUnscannable(url)).toContain("Web Store");
  });

  it.each(["https://example.com/report.pdf", "https://example.com/files/Report.PDF?download=1#page=2", "file:///home/me/doc.pdf"])(
    "PDF: %s",
    (url) => {
      expect(explainUnscannable(url)).toContain("PDF");
    },
  );

  it.each(["https://example.com/", "http://localhost:3000/app", "https://example.com/pdf-guide", "file:///home/me/page.html", undefined, "not a url"])(
    "may be scannable: %s",
    (url) => {
      expect(explainUnscannable(url)).toBeUndefined();
    },
  );

  it("does not treat a similar-looking host as the web store", () => {
    expect(explainUnscannable("https://chrome.google.com/other")).toBeUndefined();
    expect(explainUnscannable("https://example.com/chromewebstore")).toBeUndefined();
  });
});

describe("describeScanError (what the browser says when injection fails)", () => {
  it.each([
    ["Cannot access a chrome:// URL", "Browser pages"],
    ['Cannot access contents of url "chrome-extension://abc/x.html". Extension manifest must request permission to access this host.', "Browser pages"],
    ["The extensions gallery cannot be scripted.", "Web Store"],
    ["Cannot access contents of the page. Extension manifest must request permission to access the respective host.", "couldn't access this page"],
    ["No tab with id: 12", "couldn't access this page"],
    ["Frame with ID 0 was removed.", "couldn't access this page"],
    ["Cannot access file:// URL", "Allow access to file URLs"],
    ["something nobody expected", "The scan didn't finish"],
  ])("%s", (message, expected) => {
    expect(describeScanError(new Error(message))).toContain(expected);
  });

  it("handles non-Error values", () => {
    expect(describeScanError("boom")).toContain("The scan didn't finish");
    expect(describeScanError(undefined)).toContain("The scan didn't finish");
  });

  it("passes our own errors through", () => {
    expect(describeScanError(new UnscannableError("custom"))).toBe("custom");
    expect(describeScanError(new ScanTimeoutError())).toContain("took too long");
  });

  it("never shows raw technical text to the user", () => {
    for (const message of ["Cannot access a chrome:// URL", "x is not a function", "Failed to fetch"]) {
      expect(describeScanError(new Error(message))).not.toContain(message);
    }
  });
});
