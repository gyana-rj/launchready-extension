import type { Check } from "../types";
import { findMeta, isStagingHost, makeIssue, pageUrl, parseUrl, snippet, snippets } from "../utils";

export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 160;

export const checkMetaDescription: Check = (doc) => {
  const meta = findMeta(doc, "description");
  const length = meta?.getAttribute("content")?.trim().length ?? 0;
  const fix = `Write a unique meta description of ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters that summarises the page.`;

  if (length === 0) {
    return [
      makeIssue(
        "meta-description-missing",
        "warning",
        "Missing meta description",
        'The page has no <meta name="description"> (or it is empty), so search engines will pick their own snippet.',
        fix,
      ),
    ];
  }
  if (length < DESCRIPTION_MIN) {
    return [
      makeIssue(
        "meta-description-short",
        "warning",
        "Meta description is too short",
        `The meta description is ${length} characters; aim for at least ${DESCRIPTION_MIN}.`,
        fix,
        meta ? [snippet(meta)] : [],
      ),
    ];
  }
  if (length > DESCRIPTION_MAX) {
    return [
      makeIssue(
        "meta-description-long",
        "warning",
        "Meta description is too long",
        `The meta description is ${length} characters; search engines usually cut it off after ${DESCRIPTION_MAX}.`,
        fix,
        meta ? [snippet(meta)] : [],
      ),
    ];
  }
  return [];
};

export const checkH1: Check = (doc) => {
  const h1s = Array.from(doc.querySelectorAll("h1"));
  if (h1s.length === 0) {
    return [
      makeIssue(
        "h1-missing",
        "warning",
        "Missing H1 heading",
        "The page has no <h1>, which helps search engines and screen readers understand the main topic.",
        "Add exactly one <h1> that describes the page.",
      ),
    ];
  }
  if (h1s.length > 1) {
    return [
      makeIssue(
        "h1-multiple",
        "warning",
        "Multiple H1 headings",
        `The page has ${h1s.length} <h1> elements; it should have one.`,
        "Keep one <h1> for the main topic and change the others to <h2> or lower.",
        snippets(h1s),
      ),
    ];
  }
  return [];
};

export const checkHeadingOrder: Check = (doc) => {
  const skipped: Element[] = [];
  let previous = 0;
  for (const heading of Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
    const level = Number(heading.tagName[1]);
    if (previous > 0 && level > previous + 1) skipped.push(heading);
    previous = level;
  }
  if (!skipped.length) return [];
  return [
    makeIssue(
      "heading-skip",
      "warning",
      "Heading levels are skipped",
      `${skipped.length} heading(s) jump more than one level (for example H2 followed by H4), which breaks the page outline.`,
      "Use heading levels in order. Pick the level by structure, and style it with CSS if it looks too big or small.",
      snippets(skipped),
    ),
  ];
};

export const checkImageAlt: Check = (doc) => {
  const images = Array.from(doc.querySelectorAll("img:not([alt])"));
  if (!images.length) return [];
  return [
    makeIssue(
      "img-alt-missing",
      "warning",
      "Images are missing alt text",
      `${images.length} image(s) have no alt attribute. Screen readers and search engines cannot describe them.`,
      'Add a short descriptive alt attribute to each image. Use alt="" for purely decorative images.',
      snippets(images),
    ),
  ];
};

const OG_TAGS = [
  { key: "og:title", id: "og-title-missing" },
  { key: "og:description", id: "og-description-missing" },
  { key: "og:image", id: "og-image-missing" },
];

export const checkOpenGraph: Check = (doc) =>
  OG_TAGS.filter(({ key }) => !findMeta(doc, key)?.getAttribute("content")?.trim()).map(({ key, id }) =>
    makeIssue(
      id,
      "warning",
      `Missing ${key}`,
      `The page has no ${key} tag, so link previews on social networks and chat apps will be incomplete.`,
      `Add <meta property="${key}" content="..."> to the page head.`,
    ),
  );

export const checkOgStagingUrls: Check = (doc, ctx) => {
  const base = pageUrl(doc, ctx);
  const bad = ["og:url", "og:image"]
    .map((key) => findMeta(doc, key))
    .filter((meta): meta is HTMLMetaElement => {
      const url = parseUrl(meta?.getAttribute("content")?.trim() ?? "", base);
      return !!url && isStagingHost(url.hostname);
    });
  if (!bad.length) return [];
  return [
    makeIssue(
      "og-staging-url",
      "warning",
      "Open Graph URL points to localhost or staging",
      "og:url or og:image uses a local or staging domain, so shared links will show a broken or wrong preview.",
      "Change og:url and og:image to absolute URLs on the production domain.",
      snippets(bad),
    ),
  ];
};

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /dolor sit amet/i,
  /\b(your|insert|enter|add) (text|title|content|heading|company name|description) here\b/i,
  /\btext goes here\b/i,
  /\b(sample|placeholder|dummy) (text|content)\b/i,
  /click (here )?to edit/i,
];

export const checkPlaceholderText: Check = (doc) => {
  const root = doc.body ?? doc.documentElement;
  const found = new Set<Element>();
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, noscript, template")) continue;
    if (PLACEHOLDER_PATTERNS.some((p) => p.test(node.textContent ?? ""))) found.add(parent);
  }
  if (!found.size) return [];
  return [
    makeIssue(
      "placeholder-text",
      "warning",
      "Placeholder text found",
      'The page contains filler text such as "Lorem ipsum" or "Your text here".',
      "Replace every placeholder with the real content before launch.",
      snippets(found),
    ),
  ];
};

export const checkFavicon: Check = (doc) => {
  const hasIcon = Array.from(doc.querySelectorAll("link[rel]")).some(
    (l) => l.getAttribute("rel")!.toLowerCase().split(/\s+/).includes("icon") && l.getAttribute("href")?.trim(),
  );
  if (hasIcon) return [];
  return [
    makeIssue(
      "favicon-missing",
      "warning",
      "Missing favicon",
      'The page head has no <link rel="icon">. Browsers will show a blank icon in tabs and bookmarks.',
      'Add <link rel="icon" href="/favicon.ico"> (or an SVG/PNG icon) to the page head.',
    ),
  ];
};

export const checkViewport: Check = (doc) => {
  if (findMeta(doc, "viewport")?.getAttribute("content")?.trim()) return [];
  return [
    makeIssue(
      "viewport-missing",
      "warning",
      "Missing viewport meta tag",
      "Without a viewport tag the page will not scale properly on phones.",
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the page head.',
    ),
  ];
};

export const checkHtmlLang: Check = (doc) => {
  if (doc.documentElement.getAttribute("lang")?.trim()) return [];
  return [
    makeIssue(
      "html-lang-missing",
      "warning",
      "Missing lang attribute on <html>",
      "The page does not declare its language, which hurts screen readers and translation tools.",
      'Add a language code to the root element, for example <html lang="en">.',
    ),
  ];
};

export const checkEmptyLinks: Check = (doc) => {
  const links = Array.from(doc.querySelectorAll("a[href]")).filter((a) => {
    const href = a.getAttribute("href")!.trim();
    return href === "" || href === "#";
  });
  if (!links.length) return [];
  return [
    makeIssue(
      "empty-links",
      "warning",
      'Links with empty or "#" href',
      `${links.length} link(s) go nowhere. They are usually unfinished placeholders.`,
      "Point each link to its real destination, or remove it (use a <button> for actions).",
      snippets(links),
    ),
  ];
};

/** Reports links found broken by linkChecker.ts; the network part lives there. */
export const checkBrokenLinks: Check = (_doc, ctx) => {
  const broken = Object.entries(ctx.linkResults ?? {}).filter(([, status]) => status === 0 || status >= 400);
  if (!broken.length) return [];
  return [
    makeIssue(
      "broken-links",
      "warning",
      "Broken internal links",
      `${broken.length} same-site link(s) returned an error or no response.`,
      "Fix the link target, add a redirect, or remove the link.",
      broken.map(([url, status]) => `${url} (${status === 0 ? "no response" : status})`),
    ),
  ];
};

export const warningChecks: Check[] = [
  checkMetaDescription,
  checkH1,
  checkHeadingOrder,
  checkImageAlt,
  checkOpenGraph,
  checkOgStagingUrls,
  checkPlaceholderText,
  checkFavicon,
  checkViewport,
  checkHtmlLang,
  checkEmptyLinks,
  checkBrokenLinks,
];
