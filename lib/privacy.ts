/**
 * Privacy notice state (CLS-013). "draft" shows a visible banner and the open
 * questions for the KU data protection officer. Switch to "approved" only
 * after Vytis Radvila approves the content; tests/privacy-notice.test.ts then
 * refuses any open question left in the page.
 */
export const PRIVACY_NOTICE_STATUS: "draft" | "approved" = "draft"

/** Date shown on the page; update with every content change. */
export const PRIVACY_NOTICE_UPDATED = "2026 m. lapkričio 7 d."
