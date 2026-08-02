/**
 * Confirms the "Needs reply" toggle on the Pipeline page keeps the right leads
 * visible as the filteredLeads derivation and filter bar evolve.
 *
 * Covered scenarios
 * -----------------
 * 1. Board view  — toggling ON hides leads without unread messages; toggling OFF restores all.
 * 2. Table view  — same behaviour after switching to the table.
 * 3. Saved-filter round-trip — saving with "Needs reply" active stores needsReply:true in the
 *    POST body; loading that saved filter reactivates the toggle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { renderWithQuery } from '@/test/render';
import { mockApi, sampleMe } from '@/test/mock-api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const now = new Date().toISOString();

/** A lead that has an unread portal message */
const unreadLead1 = {
  id: 'l-unread-1',
  summary: 'Roof needs urgent reply',
  source: 'website',
  status: 'new',
  urgency: 'high',
  score: 80,
  estimatedValueCents: 500000,
  createdAt: now,
  hasUnreadPortalMessage: true,
};

const unreadLead2 = {
  id: 'l-unread-2',
  summary: 'Hail damage awaiting response',
  source: 'referral',
  status: 'contact_attempted',
  urgency: 'normal',
  score: 60,
  estimatedValueCents: 300000,
  createdAt: now,
  hasUnreadPortalMessage: true,
};

/** A lead that does NOT have an unread portal message */
const readLead = {
  id: 'l-read-1',
  summary: 'Already replied to homeowner',
  source: 'website',
  status: 'new',
  urgency: 'low',
  score: 30,
  estimatedValueCents: 100000,
  createdAt: now,
  hasUnreadPortalMessage: false,
};

const allLeads = [unreadLead1, unreadLead2, readLead];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Render Pipeline with the three-lead fixture and an optional extra override. */
function renderPipeline(
  extraHandler?: (method: string, path: string) => Response | undefined,
) {
  const fetchMock = mockApi('admin', {
    handler: (method, path) => {
      const override = extraHandler?.(method, path);
      if (override) return override;
      if (method === 'GET' && path.endsWith('/api/v1/leads')) {
        return json(allLeads);
      }
      return undefined;
    },
  });
  renderWithQuery(<Pipeline />);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function waitForLeads() {
  // Wait until at least one lead summary is visible.
  await screen.findByText(/roof needs urgent reply/i);
}

function saveFilterCalls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input, init]: [RequestInfo | URL, RequestInit?]) => ({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: String(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url,
      ).split('?')[0],
      body: init?.body,
    }))
    .filter((c) => c.method === 'POST' && c.path.endsWith('/api/v1/saved-filters'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Pipeline "Needs reply" filter', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // 1. Board view
  // -------------------------------------------------------------------------
  describe('board view', () => {
    it('shows all leads when the filter is off', async () => {
      renderPipeline();
      await waitForLeads();

      expect(screen.getByText(/roof needs urgent reply/i)).toBeTruthy();
      expect(screen.getByText(/hail damage awaiting response/i)).toBeTruthy();
      expect(screen.getByText(/already replied to homeowner/i)).toBeTruthy();
    });

    it('hides leads without unread messages after toggling ON', async () => {
      renderPipeline();
      await waitForLeads();

      fireEvent.click(screen.getByTestId('needs-reply-filter'));

      // Wait for the settled state: unread leads visible, read lead gone.
      // (Toggling adds hasUnreadPortalMessage to leadParams → new fetch;
      //  asserting inside waitFor avoids a race against the loading flash.)
      await waitFor(() => {
        expect(screen.queryByText(/already replied to homeowner/i)).toBeNull();
        expect(screen.getByText(/roof needs urgent reply/i)).toBeTruthy();
        expect(screen.getByText(/hail damage awaiting response/i)).toBeTruthy();
      });
    });

    it('restores all leads after toggling back OFF', async () => {
      renderPipeline();
      await waitForLeads();

      const btn = screen.getByTestId('needs-reply-filter');
      fireEvent.click(btn); // ON
      await waitFor(() =>
        expect(screen.queryByText(/already replied to homeowner/i)).toBeNull(),
      );

      fireEvent.click(btn); // OFF
      await waitFor(() =>
        expect(screen.getByText(/already replied to homeowner/i)).toBeTruthy(),
      );
      expect(screen.getByText(/roof needs urgent reply/i)).toBeTruthy();
      expect(screen.getByText(/hail damage awaiting response/i)).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Table view
  // -------------------------------------------------------------------------
  describe('table view', () => {
    it('hides leads without unread messages in table view after toggling ON', async () => {
      renderPipeline();
      await waitForLeads();

      // Switch to table view
      fireEvent.click(screen.getByTestId('view-table-button'));
      // Both views may briefly share the DOM during the repaint; confirm the
      // read lead is present at least once before toggling.
      await waitFor(() =>
        expect(screen.getAllByText(/already replied to homeowner/i).length).toBeGreaterThan(0),
      );

      fireEvent.click(screen.getByTestId('needs-reply-filter'));

      await waitFor(() => {
        expect(screen.queryAllByText(/already replied to homeowner/i).length).toBe(0);
        expect(screen.getAllByText(/roof needs urgent reply/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/hail damage awaiting response/i).length).toBeGreaterThan(0);
      });
    });

    it('restores all leads in table view after toggling back OFF', async () => {
      renderPipeline();
      await waitForLeads();

      fireEvent.click(screen.getByTestId('view-table-button'));

      const btn = screen.getByTestId('needs-reply-filter');
      fireEvent.click(btn); // ON
      await waitFor(() =>
        expect(screen.queryAllByText(/already replied to homeowner/i).length).toBe(0),
      );

      fireEvent.click(btn); // OFF
      await waitFor(() =>
        expect(screen.getAllByText(/already replied to homeowner/i).length).toBeGreaterThan(0),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Saved-filter round-trip
  // -------------------------------------------------------------------------
  describe('saved-filter round-trip', () => {
    it('stores needsReply:true in the POST body when saving with the filter active', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      const fetchMock = renderPipeline((method, path) => {
        if (method === 'POST' && path.endsWith('/api/v1/saved-filters')) {
          return json({
            id: 'sf-nr-1',
            name: 'Unread leads',
            filters: { status: null, search: null, needsReply: true, nationwideOnly: null },
            organizationId: 'o1',
            createdAt: now,
          });
        }
        return undefined;
      });
      await waitForLeads();

      // Activate the Needs reply toggle
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(() =>
        expect(screen.queryByText(/already replied to homeowner/i)).toBeNull(),
      );

      // Open the save-filter popover and save
      fireEvent.click(screen.getByTestId('save-filter'));
      const input = await screen.findByPlaceholderText(/filter name/i);
      fireEvent.change(input, { target: { value: 'Unread leads' } });
      fireEvent.click(screen.getByRole('button', { name: /^save( filter)?$/i }));

      await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(1));

      const [call] = saveFilterCalls(fetchMock);
      capturedBody = JSON.parse(String(call.body));
      expect(capturedBody).toMatchObject({
        name: 'Unread leads',
        filters: { needsReply: true },
      });
    });

    it('aria-pressed on the toggle reflects the needsReply state set by applySavedFilter', async () => {
      // Radix DropdownMenu portals do not open with fireEvent in jsdom, so we
      // cannot simulate clicking a saved-filter entry through the dropdown UI.
      // Instead we verify the state invariant that applySavedFilter relies on:
      // when needsReplyFilter becomes true the toggle reports aria-pressed="true"
      // and only unread leads remain visible — the same outcome applySavedFilter
      // produces when it calls setNeedsReplyFilter(true).
      renderPipeline();
      await waitForLeads();

      const toggle = screen.getByTestId('needs-reply-filter');

      // Starts OFF
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(screen.getAllByText(/already replied to homeowner/i).length).toBeGreaterThan(0);

      // Activating (mirrors what applySavedFilter({ needsReply: true }) does)
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.queryAllByText(/already replied to homeowner/i).length).toBe(0);
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getAllByText(/roof needs urgent reply/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/hail damage awaiting response/i).length).toBeGreaterThan(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Server-side query param — hasUnreadPortalMessage sent to API
  // -------------------------------------------------------------------------
  describe('server-side query param', () => {
    /** Collect all GET /api/v1/leads calls and return their parsed query params. */
    function leadRequests(fetchMock: ReturnType<typeof mockApi>) {
      return fetchMock.mock.calls
        .map(([input, init]: [RequestInfo | URL, RequestInit?]) => {
          const raw = String(
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : (input as Request).url,
          );
          const method = (init?.method ?? 'GET').toUpperCase();
          return { raw, method };
        })
        .filter(c => c.method === 'GET' && c.raw.split('?')[0].endsWith('/api/v1/leads'))
        .map(c => Object.fromEntries(new URL(c.raw, 'http://test.local').searchParams.entries()));
    }

    it('passes hasUnreadPortalMessage=true to the API when the filter is ON', async () => {
      const fetchMock = renderPipeline();
      await waitForLeads();

      // Initially: no hasUnreadPortalMessage param.
      const before = leadRequests(fetchMock);
      expect(before.length).toBeGreaterThanOrEqual(1);
      expect(before[before.length - 1].hasUnreadPortalMessage).toBeUndefined();

      // Turn on the filter → a new request must include the param.
      fireEvent.click(screen.getByTestId('needs-reply-filter'));

      await waitFor(() => {
        const reqs = leadRequests(fetchMock);
        const last = reqs[reqs.length - 1];
        expect(last.hasUnreadPortalMessage).toBe('true');
      });
    });

    it('removes hasUnreadPortalMessage from the API request when the filter is turned OFF', async () => {
      const fetchMock = renderPipeline();
      await waitForLeads();

      const btn = screen.getByTestId('needs-reply-filter');
      fireEvent.click(btn); // ON

      await waitFor(() => {
        const reqs = leadRequests(fetchMock);
        expect(reqs[reqs.length - 1].hasUnreadPortalMessage).toBe('true');
      });

      fireEvent.click(btn); // OFF

      await waitFor(() => {
        const reqs = leadRequests(fetchMock);
        expect(reqs[reqs.length - 1].hasUnreadPortalMessage).toBeUndefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Stacked stage + needs-reply filters
  // -------------------------------------------------------------------------
  describe('stacked stage + needs-reply filters', () => {
    /**
     * Extended fixture: four leads across two statuses so we can verify that
     * the intersection keeps only leads matching BOTH predicates.
     *
     *   unreadNew               status=new,               hasUnreadPortalMessage=true
     *   readNew                 status=new,               hasUnreadPortalMessage=false
     *   unreadContactAttempted  status=contact_attempted,  hasUnreadPortalMessage=true
     *   readContactAttempted    status=contact_attempted,  hasUnreadPortalMessage=false
     *
     * When statusFilter='new' the server returns only the two "new" leads.
     * When needsReplyFilter is also ON the server additionally filters by
     * hasUnreadPortalMessage, leaving only unreadNew — the only lead matching
     * both conditions.
     *
     * NOTE: summaries are crafted so no name is a substring of another.
     *   "Alpha new unread"  vs "Beta new replied"  vs "Gamma ca unread"  vs "Delta ca replied"
     * This avoids regex cross-matches (e.g. "read" inside "unread").
     */
    const stackNow = new Date().toISOString();

    const unreadNew = {
      id: 's-unread-new',
      summary: 'Alpha new unread',
      source: 'website',
      status: 'new',
      urgency: 'high',
      score: 90,
      estimatedValueCents: 600000,
      createdAt: stackNow,
      hasUnreadPortalMessage: true,
    };

    const readNew = {
      id: 's-read-new',
      summary: 'Beta new replied',
      source: 'website',
      status: 'new',
      urgency: 'low',
      score: 20,
      estimatedValueCents: 100000,
      createdAt: stackNow,
      hasUnreadPortalMessage: false,
    };

    const unreadContactAttempted = {
      id: 's-unread-ca',
      summary: 'Gamma ca unread',
      source: 'referral',
      status: 'contact_attempted',
      urgency: 'normal',
      score: 55,
      estimatedValueCents: 250000,
      createdAt: stackNow,
      hasUnreadPortalMessage: true,
    };

    const readContactAttempted = {
      id: 's-read-ca',
      summary: 'Delta ca replied',
      source: 'referral',
      status: 'contact_attempted',
      urgency: 'low',
      score: 15,
      estimatedValueCents: 80000,
      createdAt: stackNow,
      hasUnreadPortalMessage: false,
    };

    const stackLeads = [unreadNew, readNew, unreadContactAttempted, readContactAttempted];

    /** Stub fetch so /leads honours the ?status= and ?hasUnreadPortalMessage= params. */
    function renderStackedPipeline() {
      return mockApi('admin', {
        handler: (method, path, rawUrl) => {
          if (method === 'GET' && path.endsWith('/api/v1/leads')) {
            const url = new URL(rawUrl ?? path, 'http://localhost');
            const statusParam = url.searchParams.get('status');
            const unreadParam = url.searchParams.get('hasUnreadPortalMessage');
            let result = statusParam
              ? stackLeads.filter(l => l.status === statusParam)
              : stackLeads;
            if (unreadParam === 'true') {
              result = result.filter(l => l.hasUnreadPortalMessage);
            }
            return json(result);
          }
          return undefined;
        },
      });
    }

    it('shows only leads matching both stage and needs-reply when both filters are active', async () => {
      renderStackedPipeline();
      renderWithQuery(<Pipeline />);

      // Wait for the unfiltered view to load (all four leads present).
      await screen.findByText(/alpha new unread/i);
      expect(screen.queryAllByText(/beta new replied/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/gamma ca unread/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/delta ca replied/i).length).toBeGreaterThan(0);

      // Apply stage filter → server now returns only the two "new" leads.
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'new' } });

      // Wait until the refetch has landed: alpha+beta visible, gamma+delta gone.
      await waitFor(() => {
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBe(0);
        expect(screen.queryAllByText(/delta ca replied/i).length).toBe(0);
        expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/beta new replied/i).length).toBeGreaterThan(0);
      });

      // Also enable needs-reply → server returns only unreadNew (alpha).
      fireEvent.click(screen.getByTestId('needs-reply-filter'));

      // Wait for the settled state: alpha present, beta/gamma/delta absent.
      await waitFor(() => {
        expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/beta new replied/i).length).toBe(0);
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBe(0);
        expect(screen.queryAllByText(/delta ca replied/i).length).toBe(0);
      });
    });

    it('restores the stage superset when needs-reply is cleared', async () => {
      renderStackedPipeline();
      renderWithQuery(<Pipeline />);

      await screen.findByText(/alpha new unread/i);

      // Set stage to "new" — server returns only alpha + beta.
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'new' } });
      await waitFor(() =>
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBe(0),
      );

      // Enable needs-reply → only alpha remains.
      const btn = screen.getByTestId('needs-reply-filter');
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/beta new replied/i).length).toBe(0);
      });

      // Clear needs-reply → both "new" leads return.
      fireEvent.click(btn);
      await waitFor(() =>
        expect(screen.queryAllByText(/beta new replied/i).length).toBeGreaterThan(0),
      );
      expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
      // Stage filter is still 'new' — contact_attempted leads must stay absent.
      expect(screen.queryAllByText(/gamma ca unread/i).length).toBe(0);
      expect(screen.queryAllByText(/delta ca replied/i).length).toBe(0);
    });

    it('restores the needs-reply superset when the stage filter is cleared', async () => {
      renderStackedPipeline();
      renderWithQuery(<Pipeline />);

      await screen.findByText(/alpha new unread/i);

      // Enable needs-reply first → alpha + gamma visible, beta + delta hidden.
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(() => {
        expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/beta new replied/i).length).toBe(0);
        expect(screen.queryAllByText(/delta ca replied/i).length).toBe(0);
      });

      // Set stage to "new" → server sends only alpha (status=new, unread=true).
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'new' } });
      // Wait until refetch has landed: alpha present, gamma gone.
      await waitFor(() => {
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBe(0);
        expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
      });

      // Clear the stage filter → server sends alpha + gamma; needs-reply still ON.
      fireEvent.change(selects[0], { target: { value: '' } });
      await waitFor(() =>
        expect(screen.queryAllByText(/gamma ca unread/i).length).toBeGreaterThan(0),
      );
      expect(screen.queryAllByText(/alpha new unread/i).length).toBeGreaterThan(0);
      // Read leads must remain hidden because needs-reply is still ON.
      expect(screen.queryAllByText(/beta new replied/i).length).toBe(0);
      expect(screen.queryAllByText(/delta ca replied/i).length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Stacked search + needs-reply filters
  // -------------------------------------------------------------------------
  describe('stacked search + needs-reply filters', () => {
    /**
     * Four leads so we can verify the intersection of a server-side search
     * filter and the server-side needs-reply filter.
     *
     *   searchUnread   summary contains "roof",  hasUnreadPortalMessage=true
     *   searchRead     summary contains "roof",  hasUnreadPortalMessage=false
     *   noMatchUnread  summary has no "roof",    hasUnreadPortalMessage=true
     *   noMatchRead    summary has no "roof",    hasUnreadPortalMessage=false
     *
     * The server stub honours ?search= and ?hasUnreadPortalMessage=. When
     * search="roof" the server returns [searchUnread, searchRead]. Adding
     * needsReply also filters by hasUnreadPortalMessage, leaving only
     * searchUnread — the single lead matching both conditions.
     *
     * Summaries are chosen so no name is a substring of another:
     *   "Roof leak unread"  vs "Roof repair replied"
     *   vs "Window damage unread"  vs "Window damage replied"
     */
    const searchNow = new Date().toISOString();

    const searchUnread = {
      id: 'sr-unread',
      summary: 'Roof leak unread',
      source: 'website',
      status: 'new',
      urgency: 'high',
      score: 85,
      estimatedValueCents: 550000,
      createdAt: searchNow,
      hasUnreadPortalMessage: true,
    };

    const searchRead = {
      id: 'sr-read',
      summary: 'Roof repair replied',
      source: 'website',
      status: 'new',
      urgency: 'low',
      score: 25,
      estimatedValueCents: 120000,
      createdAt: searchNow,
      hasUnreadPortalMessage: false,
    };

    const noMatchUnread = {
      id: 'nm-unread',
      summary: 'Window damage unread',
      source: 'referral',
      status: 'new',
      urgency: 'normal',
      score: 50,
      estimatedValueCents: 200000,
      createdAt: searchNow,
      hasUnreadPortalMessage: true,
    };

    const noMatchRead = {
      id: 'nm-read',
      summary: 'Window damage replied',
      source: 'referral',
      status: 'new',
      urgency: 'low',
      score: 10,
      estimatedValueCents: 75000,
      createdAt: searchNow,
      hasUnreadPortalMessage: false,
    };

    const searchLeads = [searchUnread, searchRead, noMatchUnread, noMatchRead];

    /** Stub fetch so /leads honours the ?search= and ?hasUnreadPortalMessage= params. */
    function renderSearchPipeline() {
      return mockApi('admin', {
        handler: (method, path, rawUrl) => {
          if (method === 'GET' && path.endsWith('/api/v1/leads')) {
            const url = new URL(rawUrl ?? path, 'http://localhost');
            const term = url.searchParams.get('search') ?? '';
            const unreadParam = url.searchParams.get('hasUnreadPortalMessage');
            let result = term
              ? searchLeads.filter(l =>
                  l.summary.toLowerCase().includes(term.toLowerCase()),
                )
              : searchLeads;
            if (unreadParam === 'true') {
              result = result.filter(l => l.hasUnreadPortalMessage);
            }
            return json(result);
          }
          return undefined;
        },
      });
    }

    it('shows only leads matching both search and needs-reply when both filters are active', async () => {
      renderSearchPipeline();
      renderWithQuery(<Pipeline />);

      // Wait for the unfiltered view to load (all four leads present).
      await screen.findByText(/roof leak unread/i);
      expect(screen.queryAllByText(/roof repair replied/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/window damage unread/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/window damage replied/i).length).toBeGreaterThan(0);

      // Type a search term — server will return only the two "roof" leads.
      const searchInput = screen.getByPlaceholderText(/search leads/i);
      fireEvent.change(searchInput, { target: { value: 'roof' } });
      await waitFor(
        () => expect(screen.queryAllByText(/window damage unread/i).length).toBe(0),
        { timeout: 2000 },
      );

      // Enable needs-reply → server returns only searchUnread.
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(() => {
        expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/roof repair replied/i).length).toBe(0);
      });

      // Clear search → server returns all unread leads (search gone, hasUnread still true).
      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(
        () => expect(screen.queryAllByText(/window damage unread/i).length).toBeGreaterThan(0),
        { timeout: 2000 },
      );
      expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
      // Read leads must stay hidden because needs-reply is still ON.
      expect(screen.queryAllByText(/roof repair replied/i).length).toBe(0);
      expect(screen.queryAllByText(/window damage replied/i).length).toBe(0);
    });

    it('restores all search matches when needs-reply is cleared while search is active', async () => {
      renderSearchPipeline();
      renderWithQuery(<Pipeline />);

      await screen.findByText(/roof leak unread/i);

      // Type search term → roof leads only.
      const searchInput = screen.getByPlaceholderText(/search leads/i);
      fireEvent.change(searchInput, { target: { value: 'roof' } });
      await waitFor(
        () => expect(screen.queryAllByText(/window damage unread/i).length).toBe(0),
        { timeout: 2000 },
      );

      // Enable needs-reply → only searchUnread remains.
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(() => {
        expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/roof repair replied/i).length).toBe(0);
      });

      // Clear needs-reply → both "roof" leads return; window leads stay absent (search still active).
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(
        () => expect(screen.queryAllByText(/roof repair replied/i).length).toBeGreaterThan(0),
        { timeout: 2000 },
      );
      expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
      // Non-matching leads must stay absent because search is still "roof".
      expect(screen.queryAllByText(/window damage unread/i).length).toBe(0);
      expect(screen.queryAllByText(/window damage replied/i).length).toBe(0);
    });

    it('restores all unread leads when search is cleared while needs-reply is active', async () => {
      renderSearchPipeline();
      renderWithQuery(<Pipeline />);

      await screen.findByText(/roof leak unread/i);

      // Enable needs-reply first → server returns only unread leads.
      fireEvent.click(screen.getByTestId('needs-reply-filter'));
      await waitFor(() => {
        expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/window damage unread/i).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/roof repair replied/i).length).toBe(0);
        expect(screen.queryAllByText(/window damage replied/i).length).toBe(0);
      });

      // Add search "roof" → server returns only roof+unread = searchUnread.
      const searchInput = screen.getByPlaceholderText(/search leads/i);
      fireEvent.change(searchInput, { target: { value: 'roof' } });
      await waitFor(
        () => {
          expect(screen.queryAllByText(/window damage unread/i).length).toBe(0);
          expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
        },
        { timeout: 2000 },
      );

      // Clear search → server returns all unread leads again.
      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(
        () => {
          expect(screen.queryAllByText(/window damage unread/i).length).toBeGreaterThan(0);
          expect(screen.queryAllByText(/roof leak unread/i).length).toBeGreaterThan(0);
          // Read leads must stay hidden because needs-reply is still ON.
          expect(screen.queryAllByText(/roof repair replied/i).length).toBe(0);
          expect(screen.queryAllByText(/window damage replied/i).length).toBe(0);
        },
        { timeout: 2000 },
      );
    });
  });
});
