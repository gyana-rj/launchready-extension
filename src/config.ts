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
