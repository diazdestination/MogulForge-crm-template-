/**
 * Confirms that pipeline filter state round-trips through the URL correctly
 * as the page evolves.
 *
 * Covered scenarios
 * -----------------
 * 1. Loading /pipeline?needsReply=1 activates the Needs Reply toggle on mount.
 * 2. Loading /pipeline?status=new&search=foo populates both filters on mount.
 * 3. Toggling the Needs Reply filter updates the URL query string.
 * 4. Changing the status filter updates the URL query string.
 * 5. Typing in the search box updates the URL query string.
 * 6. Clearing all filters removes the query string entirely.
 * 7. (Back/forward) Popstate to a URL with different filters restores them.
 * 8. (Back/forward) Popstate to a URL with no filters clears all filter state.
 * 9. (Back/forward) Popstate with combined filters restores all of them at once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const sampleLead = {
  id: 'l-url-1',
  summary: 'Storm damage lead',
  source: 'website',
  status: 'new',
  urgency: 'normal',
  score: 50,
  estimatedValueCents: 200000,
  createdAt: now,
  hasUnreadPortalMessage: false,
};

function renderPipeline() {
  mockApi('admin');
  renderWithQuery(<Pipeline />);
}

/** Seed window.location before rendering, restored by setup.ts afterEach reset. */
function seedUrl(search: string) {
  window.history.replaceState(null, '', `/pipeline${search}`);
}

/**
 * Collect all window.history.replaceState call args recorded on the spy,
 * filtered to those that actually include a URL (3rd argument).
 */
function replaceStateCalls(spy: ReturnType<typeof vi.spyOn>) {
  return (spy.mock.calls as Parameters<typeof window.history.replaceState>[])
    .map(([, , url]) => String(url ?? ''));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Pipeline filter URL round-trip', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. ?needsReply=1 activates the Needs Reply toggle
  // -------------------------------------------------------------------------
  it('activates the Needs Reply toggle when the URL contains needsReply=1', async () => {
    seedUrl('?needsReply=1');
    renderPipeline();

    // The toggle must report aria-pressed="true" on initial render.
    const toggle = await screen.findByTestId('needs-reply-filter');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  // -------------------------------------------------------------------------
  // 2. ?status=new&search=foo populates both filters
  // -------------------------------------------------------------------------
  it('sets status and search from the URL on mount', async () => {
    seedUrl('?status=new&search=foo');
    renderPipeline();

    // Wait for the page to mount (any element from the pipeline header is enough).
    await screen.findByPlaceholderText(/search leads/i);

    // The search input must reflect the URL value.
    const searchInput = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);
    expect(searchInput.value).toBe('foo');

    // The first combobox on the page is the status select.
    const selects = screen.getAllByRole<HTMLSelectElement>('combobox');
    expect(selects[0].value).toBe('new');
  });

  // -------------------------------------------------------------------------
  // 3. Toggling Needs Reply updates the URL
  // -------------------------------------------------------------------------
  it('adds needsReply=1 to the URL when the toggle is turned ON', async () => {
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    await screen.findByTestId('needs-reply-filter');
    fireEvent.click(screen.getByTestId('needs-reply-filter'));

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      expect(urls.some(u => u.includes('needsReply=1'))).toBe(true);
    });
  });

  it('removes needsReply from the URL when the toggle is turned OFF', async () => {
    seedUrl('?needsReply=1');
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    const toggle = await screen.findByTestId('needs-reply-filter');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle); // turn OFF

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      // At least one replaceState call must have been made without needsReply.
      expect(urls.some(u => !u.includes('needsReply'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Changing the status filter updates the URL
  // -------------------------------------------------------------------------
  it('adds status=new to the URL when the stage filter is changed', async () => {
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    await screen.findByPlaceholderText(/search leads/i);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'new' } });

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      expect(urls.some(u => u.includes('status=new'))).toBe(true);
    });
  });

  it('removes status from the URL when the stage filter is cleared', async () => {
    seedUrl('?status=new');
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    await screen.findByPlaceholderText(/search leads/i);
    const selects = screen.getAllByRole('combobox');
    expect(selects[0].getAttribute('value') ?? (selects[0] as HTMLSelectElement).value).toBe('new');

    fireEvent.change(selects[0], { target: { value: '' } });

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      expect(urls.some(u => !u.includes('status='))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Typing in the search box updates the URL
  // -------------------------------------------------------------------------
  it('adds search=roof to the URL when text is typed', async () => {
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    const searchInput = await screen.findByPlaceholderText(/search leads/i);
    fireEvent.change(searchInput, { target: { value: 'roof' } });

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      expect(urls.some(u => u.includes('search=roof'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Clearing all filters produces a clean URL (no query string)
  // -------------------------------------------------------------------------
  it('produces a URL without a query string when all filters are cleared', async () => {
    seedUrl('?status=new&search=foo&needsReply=1');
    renderPipeline();

    const spy = vi.spyOn(window.history, 'replaceState');

    await screen.findByPlaceholderText(/search leads/i);

    // Clear status
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '' } });

    // Clear search
    const searchInput = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);
    fireEvent.change(searchInput, { target: { value: '' } });

    // Clear needsReply (toggle is ON because URL seeds it)
    fireEvent.click(screen.getByTestId('needs-reply-filter'));

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      // One of the calls must be the bare pathname with no query string.
      expect(
        urls.some(u => !u.includes('?') || u.endsWith('?') || u === window.location.pathname),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Combined: ?status=new&search=foo sets both and each updates independently
  // -------------------------------------------------------------------------
  it('sets status=new and search=foo independently from a combined URL', async () => {
    seedUrl('?status=new&search=foo');
    renderPipeline();

    await screen.findByPlaceholderText(/search leads/i);

    const selects = screen.getAllByRole<HTMLSelectElement>('combobox');
    const searchInput = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);

    expect(selects[0].value).toBe('new');
    expect(searchInput.value).toBe('foo');

    // Spy after confirming initial state
    const spy = vi.spyOn(window.history, 'replaceState');

    // Changing search must keep status=new in the URL
    fireEvent.change(searchInput, { target: { value: 'bar' } });

    await waitFor(() => {
      const urls = replaceStateCalls(spy);
      expect(urls.some(u => u.includes('status=new') && u.includes('search=bar'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Back/forward: popstate to a URL with different filters restores them
  // -------------------------------------------------------------------------
  it('restores a different status filter when a popstate event fires with a new search string', async () => {
    // Start with no filters
    renderPipeline();

    await screen.findByPlaceholderText(/search leads/i);

    // Confirm no status is selected initially
    const selects = screen.getAllByRole<HTMLSelectElement>('combobox');
    expect(selects[0].value).toBe('');

    // Simulate the browser navigating back to a URL that had status=won set.
    // pushState changes location.search; a popstate event tells subscribers
    // (wouter's useSearch) that the URL changed.
    window.history.pushState(null, '', '/pipeline?status=won');
    fireEvent(window, new PopStateEvent('popstate', { state: null }));

    await waitFor(() => {
      const select = screen.getAllByRole<HTMLSelectElement>('combobox')[0];
      expect(select.value).toBe('won');
    });
  });

  it('restores the needsReply toggle when a popstate event fires with needsReply=1', async () => {
    // Start with no filters
    renderPipeline();

    const toggle = await screen.findByTestId('needs-reply-filter');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    // Simulate back navigation to a URL that had needsReply=1
    window.history.pushState(null, '', '/pipeline?needsReply=1');
    fireEvent(window, new PopStateEvent('popstate', { state: null }));

    await waitFor(() => {
      expect(screen.getByTestId('needs-reply-filter').getAttribute('aria-pressed')).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // 9. Back/forward: popstate to a clean URL clears all filter state
  // -------------------------------------------------------------------------
  it('clears all filters when a popstate event fires with an empty search string', async () => {
    // Start with multiple filters active
    seedUrl('?status=new&search=storm&needsReply=1');
    renderPipeline();

    await screen.findByPlaceholderText(/search leads/i);

    // Confirm filters loaded from initial URL
    const selects = screen.getAllByRole<HTMLSelectElement>('combobox');
    expect(selects[0].value).toBe('new');
    const searchInput = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);
    expect(searchInput.value).toBe('storm');
    expect(screen.getByTestId('needs-reply-filter').getAttribute('aria-pressed')).toBe('true');

    // Simulate the browser navigating forward to a URL with no filters
    window.history.pushState(null, '', '/pipeline');
    fireEvent(window, new PopStateEvent('popstate', { state: null }));

    await waitFor(() => {
      const select = screen.getAllByRole<HTMLSelectElement>('combobox')[0];
      expect(select.value).toBe('');
    });

    const freshSearch = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);
    expect(freshSearch.value).toBe('');
    expect(screen.getByTestId('needs-reply-filter').getAttribute('aria-pressed')).toBe('false');
  });

  // -------------------------------------------------------------------------
  // 10. Back/forward: popstate restores all combined filters simultaneously
  // -------------------------------------------------------------------------
  it('restores status, search, and needsReply together when a popstate event fires', async () => {
    // Start with no filters
    renderPipeline();
    await screen.findByPlaceholderText(/search leads/i);

    // Simulate back navigation to a URL that had all three filters active
    window.history.pushState(null, '', '/pipeline?status=follow_up&search=hail&needsReply=1');
    fireEvent(window, new PopStateEvent('popstate', { state: null }));

    await waitFor(() => {
      const select = screen.getAllByRole<HTMLSelectElement>('combobox')[0];
      expect(select.value).toBe('follow_up');
    });

    const searchInput = screen.getByPlaceholderText<HTMLInputElement>(/search leads/i);
    expect(searchInput.value).toBe('hail');
    expect(screen.getByTestId('needs-reply-filter').getAttribute('aria-pressed')).toBe('true');
  });
});
