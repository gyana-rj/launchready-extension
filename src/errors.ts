// Friendly messages for pages that can't be scanned and scans that fail.

const BROWSER_PAGE =
  "Browser pages (like chrome:// pages and the new tab page) can't be scanned. Open the website you want to check and try again.";
const WEB_STORE =
  "The Chrome Web Store can't be scanned because Chrome doesn't let extensions run on it. Open the website you want to check and try again.";
const PDF =
  "PDF files can't be scanned. LaunchReady checks web pages (HTML). Open the web page you want to check and try again.";
const FILE_ACCESS =
  "Local files can't be scanned unless you turn on \"Allow access to file URLs\" for LaunchReady on the chrome://extensions page.";
const NO_ACCESS =
  "LaunchReady couldn't access this page, so it can't be scanned. Reload the page, then click the LaunchReady icon and try again. (Some pages, like browser pages and the Web Store, can never be scanned.)";
const TIMEOUT = "The scan took too long and was stopped. The site may be slow to respond. Try again.";
const GENERIC = "The scan didn't finish. Reload the page and try again. If it keeps failing, the page may block extensions.";

/** The page can't be scanned, and we know why before trying. */
export class UnscannableError extends Error {}
export class ScanTimeoutError extends Error {}

function isWebStore(url: URL): boolean {
  return (
    url.hostname === "chromewebstore.google.com" ||
    (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore")) ||
    (url.hostname === "microsoftedge.microsoft.com" && url.pathname.startsWith("/addons"))
  );
}

/** Message if this tab URL can never be scanned; undefined if it might be (or the URL is unknown). */
export function explainUnscannable(tabUrl: string | undefined): string | undefined {
  if (!tabUrl) return undefined;
  let url: URL;
  try {
    url = new URL(tabUrl);
  } catch {
    return undefined;
  }
  if (url.protocol === "file:") return /\.pdf$/i.test(url.pathname) ? PDF : undefined;
  if (url.protocol !== "http:" && url.protocol !== "https:") return BROWSER_PAGE;
  if (isWebStore(url)) return WEB_STORE;
  if (/\.pdf$/i.test(url.pathname)) return PDF;
  return undefined;
}

/** Turns whatever went wrong into a message a non-technical user can act on. */
export function describeScanError(error: unknown): string {
  if (error instanceof UnscannableError) return error.message;
  if (error instanceof ScanTimeoutError) return TIMEOUT;
  const text = error instanceof Error ? error.message : String(error);
  if (/gallery|web ?store/i.test(text)) return WEB_STORE;
  if (/chrome:\/\/|chrome-extension|chrome-error|edge:\/\/|devtools|about:/i.test(text)) return BROWSER_PAGE;
  if (/pdf/i.test(text)) return PDF;
  if (/file:\/\/|file url/i.test(text)) return FILE_ACCESS;
  if (/cannot access|not allowed|permission|frame with id|no tab|tabs? cannot|was removed|closed/i.test(text)) return NO_ACCESS;
  return GENERIC;
}
