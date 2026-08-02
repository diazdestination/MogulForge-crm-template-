/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                CLIENT CONFIGURATION — REBRAND HERE           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * This is the single file to edit when deploying this CRM for a
 * new client. After updating these values:
 *   1. Replace public/favicon.ico and src/assets/logo.png with the
 *      new client's logo.
 *   2. Update the --color-primary CSS variable in src/index.css to
 *      match primaryColor below (search for "hsl(" in that file).
 *   3. Update the <title> in index.html.
 */
export const CLIENT = {
  /** Full legal / display business name */
  businessName: 'Painless Roofing & Water Restoration',

  /** Short name used in nav bars and compact UI elements */
  businessShortName: 'Painless',

  /** Application title shown in the browser tab and nav */
  appName: 'Painless Command Center',

  /**
   * Brand primary color hex.
   * Keep in sync with --color-primary in src/index.css.
   * Current: International Klein Blue.
   */
  primaryColor: '#0033A0',

  /** Business phone number (display format, used in message templates) */
  phone: '(404) 444-4476',

  /** IANA timezone identifier for this business */
  timezone: 'America/New_York',
} as const;
