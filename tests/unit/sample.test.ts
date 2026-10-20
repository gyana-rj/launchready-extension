import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit";

describe("runAudit", () => {
  it("returns an array for a parsed document", () => {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
    expect(Array.isArray(runAudit(doc))).toBe(true);
  });
});
