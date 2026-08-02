/**
 * Client-side mirror of the API's automation template renderer
 * (artifacts/api-server/src/services/automation.ts renderTemplate).
 * Keep the placeholder set and the {{ key }} syntax in lockstep.
 */

import { CLIENT } from './client.config';

export const SAMPLE_TEMPLATE_VARS: Record<string, string> = {
  'contact.firstName': 'Jordan',
  'business.name': CLIENT.businessName,
  'business.phone': CLIENT.phone,
};

export const KNOWN_PLACEHOLDERS = Object.keys(SAMPLE_TEMPLATE_VARS);

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export interface TemplatePreview {
  /** Text with known placeholders replaced by sample values; unknown ones left as-is. */
  rendered: string;
  /** Distinct unknown placeholder keys, in order of first appearance. */
  unknownPlaceholders: string[];
}

export function previewTemplate(input: string): TemplatePreview {
  const unknown: string[] = [];
  const rendered = input.replace(PLACEHOLDER_RE, (match, key: string) => {
    const value = SAMPLE_TEMPLATE_VARS[key];
    if (value === undefined) {
      if (!unknown.includes(key)) unknown.push(key);
      // Keep the raw placeholder visible so the admin can spot the typo;
      // the real renderer would replace it with an empty string.
      return match;
    }
    return value;
  });
  return { rendered, unknownPlaceholders: unknown };
}
