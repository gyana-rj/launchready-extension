/**
 * Free beta. When true, isPro() is true for everyone and the UI says "Free during beta" instead of
 * showing upgrade prompts and the license key field. Set to false (or build with VITE_BETA_MODE=false)
 * to bring back the Free and Pro tiers. Test builds do that through .env.test and .env.e2e.
 */
export const BETA_MODE: boolean = import.meta.env.VITE_BETA_MODE !== "false";

/** Where feedback and privacy questions go. Also written in src/privacy/privacy.html (a test keeps them in sync). */
export const FEEDBACK_EMAIL = "devgyanaranjan@gmail.com";
export const FEEDBACK_URL = `mailto:${FEEDBACK_EMAIL}?subject=LaunchReady%20feedback`;

/** Pricing and limits. Edit values here only. */
export const config = {
  pricing: {
    currency: "USD",
    monthly: 9,
    yearly: 79,
    lifetime: 149,
  },
  freeScansPerDay: 5,
  historyLimit: 200,
  bulkScanLimit: 50,
  brokenLinkCheckLimit: 50,
} as const;
