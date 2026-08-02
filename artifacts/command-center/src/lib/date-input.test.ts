import { describe, expect, it } from 'vitest';

import { toLocalDateInputValue } from './date-input';

describe('toLocalDateInputValue', () => {
  it('returns the local calendar date, not the UTC date', () => {
    // An end-of-day local timestamp must round-trip to the same local date
    // regardless of the machine's UTC offset.
    const localEndOfDay = new Date(2026, 7, 15, 23, 59, 59); // Aug 15, 2026 local
    expect(toLocalDateInputValue(localEndOfDay.toISOString())).toBe('2026-08-15');
  });

  it('handles start-of-day local timestamps too', () => {
    const localStartOfDay = new Date(2026, 0, 2, 0, 0, 1); // Jan 2, 2026 local
    expect(toLocalDateInputValue(localStartOfDay.toISOString())).toBe('2026-01-02');
  });

  it('returns an empty string for invalid input', () => {
    expect(toLocalDateInputValue('not-a-date')).toBe('');
  });
});
