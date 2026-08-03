/**
 * Confirms compound Pipeline filter states never hide valid leads.
 *
 * Each filter (Nationwide, Needs-reply, Mine/owner, text search) is tested
 * alone elsewhere; these tests cover the interplay so a change to one
 * filter's logic can't silently drop leads that should stay visible when
 * another filter is also active.
 *
 * Covered scenarios
 * -----------------
 * 1. Nationwide + Needs-reply — API request narrows to source='nationwide-inquiry'
 *    (and hasUnreadPortalMessage=true); only nationwide leads with unread
 *    homeowner messages stay visible.
 * 2. Mine (owner) + Needs-reply — leads assigned to the current rep that need
 *    a reply stay visible; other reps' leads and answered leads are hidden.
 *    Clearing Needs-reply widens back to all of the rep's leads.
 * 3. Owner filter + text search — a lead matching both the selected owner and
 *    the search text is never dropped; clearing either filter restores the
 *    wider set.
 *
 * The mock API filters the fixture set by the real query params, so these
 * assertions exercise both the server-side narrowing (what we ask for) and
 * the client-side narrowing (what we render) on visible lead rows.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Fixtures — current rep is u1 (mock-api's sampleMe). All leads share status
// 'new' so they render in one board column.
// ---------------------------------------------------------------------------
const base = { status: 'new', urgency: 'normal', score: 50, estimatedValueCents: 100000, createdAt: now };

const nwUnreadMine = { ...base, id: 'l-nw-unread-mine', summary: 'Nationwide Denver hail', source: 'nationwide-inquiry', assignedUserId: 'u1', hasUnreadPortalMessage: true };
const nwReadOther = { ...base, id: 'l-nw-read-other', summary: 'Nationwide Tulsa wind', source: 'nationwide-inquiry', assignedUserId: 'u2', hasUnreadPortalMessage: false };
const webUnreadMine = { ...base, id: 'l-web-unread-mine', summary: 'Website Austin leak', source: 'website', assignedUserId: 'u1', hasUnreadPortalMessage: true };
const webReadMine = { ...base, id: 'l-web-read-mine', summary: 'Website Reno shingles', source: 'website', assignedUserId: 'u1', hasUnreadPortalMessage: false };
const webReadOther = { ...base, id: 'l-web-read-other', summary: 'Website Boise gutter', source: 'website', assignedUserId: 'u2', hasUnreadPortalMessage: false };

const ALL_LEADS = [nwUnreadMine, nwReadOther, webUnreadMine, webReadMine, webReadOther];

const users = [
  { id: 'u1', email: 'user@example.com', firstName: 'Test', lastName: 'User', role: 'admin', isActive: true },
  { id: 'u2', email: 'riley@example.com', firstName: 'Riley', lastName: 'Ops', role: 'member', isActive: true },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

/**
 * mockApi handler that behaves like the real leads endpoint: it filters the
 * fixture set by the request's query params so tests see realistic server
 * narrowing before the client-side filters run.
 */
function paramAwareApi() {
  return mockApi('admin', {
    handler: (method, path, rawUrl) => {
      if (method !== 'GET') return undefined;
      if (path.endsWith('/api/v1/users')) return json(users);
      if (path.endsWith('/api/v1/leads')) {
        const params = new URL(String(rawUrl), 'http://test.local').searchParams;
        let rows = ALL_LEADS;
        const source = params.get('source');
        if (source) rows = rows.filter(l => l.source === source);
        const assigned = params.get('assignedUserId');
        if (assigned) rows = rows.filter(l => l.assignedUserId === assigned);
        if (params.get('hasUnreadPortalMessage') === 'true') rows = rows.filter(l => l.hasUnreadPortalMessage);
        const search = params.get('search')?.toLowerCase();
        if (search) rows = rows.filter(l => l.summary.toLowerCase().includes(search));
        return json(rows);
      }
      return undefined;
    },
  });
}

/** All GET /api/v1/leads requests, parsed into their query params. */
function leadRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input, init]: [RequestInfo | URL, RequestInit?]) => {
      const raw = String(
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url,
      );
      const method = (init?.method ?? 'GET').toUpperCase();
      return { raw, method };
    })
    .filter(c => c.method === 'GET' && c.raw.split('?')[0].endsWith('/api/v1/leads'))
    .map(c => Object.fromEntries(new URL(c.raw, 'http://test.local').searchParams.entries()));
}

function lastLeadRequest(fetchMock: ReturnType<typeof mockApi>) {
  const reqs = leadRequests(fetchMock);
  return reqs[reqs.length - 1];
}

async function waitForVisible(summaries: string[], hidden: string[]) {
  await waitFor(() => {
    for (const s of summaries) expect(screen.getByText(s)).toBeTruthy();
    for (const s of hidden) expect(screen.queryByText(s)).toBeNull();
  });
}

describe('Pipeline compound filters', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  // -------------------------------------------------------------------------
  // 1. Nationwide + Needs-reply
  // -------------------------------------------------------------------------
  it('Nationwide + Needs-reply narrows the API query and shows only nationwide leads with unread messages', async () => {
    const fetchMock = paramAwareApi();
    renderWithQuery(<Pipeline />);

    // All fixtures visible with no filters.
    await waitForVisible(ALL_LEADS.map(l => l.summary), []);

    fireEvent.click(screen.getByTestId('nationwide-filter'));
    fireEvent.click(screen.getByTestId('needs-reply-filter'));

    await waitFor(() => {
      const last = lastLeadRequest(fetchMock);
      expect(last.source).toBe('nationwide-inquiry');
      expect(last.hasUnreadPortalMessage).toBe('true');
    });

    // Only the nationwide lead with an unread homeowner message survives.
    await waitForVisible(
      [nwUnreadMine.summary],
      [nwReadOther.summary, webUnreadMine.summary, webReadMine.summary, webReadOther.summary],
    );
  });

  // -------------------------------------------------------------------------
  // 2. Mine (owner) + Needs-reply
  // -------------------------------------------------------------------------
  it('Mine + Needs-reply keeps my unread leads visible, hides other reps and answered leads; clearing Needs-reply widens back', async () => {
    const fetchMock = paramAwareApi();
    renderWithQuery(<Pipeline />);
    await waitForVisible(ALL_LEADS.map(l => l.summary), []);

    // Owner = Mine (current rep u1).
    fireEvent.change(screen.getByTestId('owner-filter'), { target: { value: 'me' } });
    await waitFor(() => expect(lastLeadRequest(fetchMock).assignedUserId).toBe('u1'));

    fireEvent.click(screen.getByTestId('needs-reply-filter'));

    // My unread leads stay; other reps' leads and my answered lead are hidden.
    await waitForVisible(
      [nwUnreadMine.summary, webUnreadMine.summary],
      [webReadMine.summary, nwReadOther.summary, webReadOther.summary],
    );

    // Clearing Needs-reply widens back to all of MY leads (still not other reps').
    fireEvent.click(screen.getByTestId('needs-reply-filter'));
    await waitForVisible(
      [nwUnreadMine.summary, webUnreadMine.summary, webReadMine.summary],
      [nwReadOther.summary, webReadOther.summary],
    );
  });

  // -------------------------------------------------------------------------
  // 3. Owner filter + text search
  // -------------------------------------------------------------------------
  it('owner + search keeps a lead matching both; clearing either filter restores the wider set', async () => {
    const fetchMock = paramAwareApi();
    renderWithQuery(<Pipeline />);
    await waitForVisible(ALL_LEADS.map(l => l.summary), []);

    // Wait for the users list so the specific-owner option exists.
    const ownerSelect = screen.getByTestId('owner-filter') as HTMLSelectElement;
    await waitFor(() => expect(ownerSelect.querySelectorAll('option').length).toBeGreaterThan(2));

    // Owner = Riley (u2) + search matching one of Riley's leads.
    fireEvent.change(ownerSelect, { target: { value: 'u2' } });
    fireEvent.change(screen.getByPlaceholderText('Search leads...'), { target: { value: 'Tulsa' } });

    await waitFor(() => {
      const last = lastLeadRequest(fetchMock);
      expect(last.assignedUserId).toBe('u2');
      expect(last.search).toBe('Tulsa');
    });

    // The lead matching BOTH owner and search is never dropped.
    await waitForVisible(
      [nwReadOther.summary],
      [webReadOther.summary, nwUnreadMine.summary, webUnreadMine.summary, webReadMine.summary],
    );

    // Clearing the search restores all of Riley's leads.
    fireEvent.change(screen.getByPlaceholderText('Search leads...'), { target: { value: '' } });
    await waitForVisible(
      [nwReadOther.summary, webReadOther.summary],
      [nwUnreadMine.summary, webUnreadMine.summary, webReadMine.summary],
    );

    // Clearing the owner filter too restores the full set.
    fireEvent.change(ownerSelect, { target: { value: '' } });
    await waitForVisible(ALL_LEADS.map(l => l.summary), []);
  });
});
