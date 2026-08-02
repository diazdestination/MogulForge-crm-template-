/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                CLIENT CONFIGURATION — REBRAND HERE           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * This is the ONLY file to edit when deploying this CRM for a new
 * client. After updating these values:
 *   1. Replace public/favicon.ico and src/assets/logo.png with the
 *      new client's logo.
 *
 * The browser tab title, meta tags, and brand primary color are all
 * injected automatically from this file at build time — no manual
 * edits to index.html or index.css are needed.
 */
export const CLIENT = {
  /** Full legal / display business name */
  businessName: 'Painless Roofing & Water Restoration',

  /** Short name used in nav bars and compact UI elements */
  businessShortName: 'Painless',

  /** Application title shown in the browser tab and meta tags */
  appName: 'Painless Command Center',

  /**
   * Brand primary color — hex, for reference / design tools.
   * Current: International Klein Blue.
   */
  primaryColor: '#0033A0',

  /**
   * Brand primary color as an HSL triple (space-separated, no commas),
   * used to set the CSS --primary variable injected at build time.
   *
   * Light-mode value. If you change primaryColor above, update this
   * to match. Tip: most design tools show HSL — use the "H S% L%"
   * values (without the % signs), e.g. "221 80% 35%".
   */
  primaryHsl: '221 80% 35%',

  /**
   * Dark-mode variant of the primary color (typically the same hue
   * and saturation, but a higher lightness so it reads on dark bg).
   */
  primaryHslDark: '221 80% 60%',

  /** Business phone number (display format, used in message templates) */
  phone: '(404) 444-4476',

  /** IANA timezone identifier for this business */
  timezone: 'America/New_York',
} as const;
