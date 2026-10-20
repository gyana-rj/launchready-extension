# Chrome Web Store listing: LaunchReady

"LaunchReady" is a placeholder name. Change it in `public/manifest.json` and here before publishing.

## Store fields

**Name**
LaunchReady

**Category**
Developer Tools

**Language**
English

### Short description
(Chrome allows 132 characters. This is the same text as `description` in `public/manifest.json`; a unit test keeps them in sync.)

```
Pre-launch website checker. Finds launch mistakes and tells you how to fix them. Runs entirely in your browser.
```

### Full description

```
Launch the site, not the mistakes.

LaunchReady scans any web page and finds the mistakes that embarrass freelancers and agencies on launch day: a leftover noindex tag, a canonical link pointing at the staging site, a robots.txt that blocks Google, missing titles, placeholder text, broken links. For every problem it explains what is wrong and exactly how to fix it.

Everything runs inside your browser. Nothing is sent to a server, because there is no server.

WHAT IT CHECKS

Critical (these can hide your site from search or break it)
• noindex in a robots meta tag or the X-Robots-Tag header
• robots.txt that blocks all crawlers ("Disallow: /")
• canonical URL pointing to another host, localhost or a staging domain (staging., dev., test., vercel.app, netlify.app, pages.dev)
• insecure http resources on an https page (mixed content)
• missing page title

Warnings (these cost you rankings, shares or polish)
• missing, too short or too long meta description
• missing or multiple H1, skipped heading levels
• images without alt text
• missing Open Graph title, description or image, or Open Graph URLs pointing at staging or localhost
• lorem ipsum and other placeholder text
• missing favicon, viewport tag or html lang
• links with an empty or "#" address
• broken links on the same site

Info
• word count, number of links, number of images

HOW IT WORKS
Open the page you want to check, click the LaunchReady icon, and press "Scan this page". You get a score out of 100, the number of critical issues, warnings and notes, and a list you can expand to see the fix for each one.

FREE
• 5 scans per day
• Full issue list with how-to-fix guidance

PRO
• Unlimited scans
• Audit history (your last 200 scans)
• CSV export
• Branded client report with your logo, agency name, client name and date, ready to save as a PDF
• Bulk scan of up to 50 pasted URLs (pages are checked as raw HTML; content that only appears after JavaScript runs is not included)

PRIVATE BY DESIGN
• No account, no analytics, no ads, no tracking
• No data leaves your browser
• Scans only run when you click; nothing runs in the background
• Site access for bulk scans is optional and requested only when you use it
```

### Feature list (for the "Features" bullets or promo copy)

- Finds 20+ common launch mistakes in one click
- Plain-language explanation and fix for every issue
- Score out of 100 with critical, warning and info counts
- Checks response headers, robots.txt and same-site links, not just the HTML
- Branded, print-ready client reports (Pro)
- Audit history and CSV export (Pro)
- Bulk scan up to 50 URLs (Pro)
- Light and dark mode
- 100% local: no servers, no tracking

## Developer Dashboard: Privacy tab

**Single purpose**
Scan the web page the user chooses for common pre-launch mistakes (SEO, metadata, links, content) and explain how to fix them.

**Permission justifications**

| Permission | Why |
| --- | --- |
| `activeTab` | Lets the extension run its checks on the tab the user is looking at, only after they click the extension. |
| `scripting` | Injects the audit script into that tab to read its HTML and fetch its headers, robots.txt and links. |
| `storage` | Keeps the daily scan count, the last scan, Pro audit history, the license key and report branding on the user's device. |
| Optional host permissions (`http://*/*`, `https://*/*`) | Requested at the moment the user starts a bulk scan, only for the sites they pasted, so the browser can fetch those pages. Never requested otherwise. |

**Remote code**
No. All code is bundled in the extension.

**Data usage disclosures**
Declare that the extension does **not** collect or transmit any of the listed user data types. The page content it reads is processed locally and never leaves the browser. Tick all three certifications (no selling data, no use unrelated to the single purpose, no creditworthiness or lending use).

**Privacy policy URL**
Required by the Web Store and it must be a public web address. The policy is `src/privacy/privacy.html`. It is a single self-contained file (inline styles, no scripts), so publish `dist/src/privacy/privacy.html` on your website (GitHub Pages works) and paste that URL here. Add a contact email to the policy first (search for "add your contact email").

## Store assets to produce

- [x] Store icon, 128×128 PNG: `public/icons/icon-128.png` (also 16, 32 and 48 for the toolbar and extensions page)
- [ ] Screenshots, at least 1, up to 5, 1280×800 or 640×400. Suggested set:
  1. Popup after scanning a page with critical issues (score and counts visible)
  2. An expanded issue showing the "How to fix" text
  3. The branded client report with a logo
  4. Bulk scan results table
  5. Popup in dark mode
- [ ] Small promo tile, 440×280 (optional but recommended)

## Before submitting

- [ ] Choose the final product name and update the manifest, this file and the privacy policy.
- [ ] Add the contact email to the privacy policy and publish it at a public URL.
- [ ] Wire real license checking in `src/license.ts` (today it is a stub that accepts a test key) and update the privacy policy to say what is sent. Do not list Pro prices publicly until buying a license works. Prices are in `src/config.ts`.
- [ ] Bump `version` in `public/manifest.json`, run `npm run build`, and zip the contents of `dist/`.
