/**
 * Convert an ISO timestamp to the local calendar date value for an
 * `<input type="date">` (YYYY-MM-DD). Never use `toISOString().slice(0, 10)`
 * for this: it is UTC-based, so an end-of-day local timestamp shifts to the
 * next calendar day in negative-offset time zones.
 */
export function toLocalDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
