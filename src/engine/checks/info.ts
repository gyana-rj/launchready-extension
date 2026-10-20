import type { Check } from "../types";
import { makeIssue, visibleText } from "../utils";

export const checkPageStats: Check = (doc) => {
  const words = visibleText(doc).split(/\s+/).filter(Boolean).length;
  const links = doc.querySelectorAll("a[href]").length;
  const images = doc.querySelectorAll("img").length;
  return [
    makeIssue(
      "page-stats",
      "info",
      "Page statistics",
      `${words} words, ${links} links, ${images} images.`,
      "Nothing to fix. Very thin pages (under about 300 words) can struggle to rank.",
    ),
  ];
};

export const infoChecks: Check[] = [checkPageStats];
