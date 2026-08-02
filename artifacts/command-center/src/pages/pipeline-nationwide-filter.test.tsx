/**
 * Confirms the "Nationwide" toggle on the Pipeline page keeps passing the right
 * query params to the leads API as the filter bar and leadParams construction evolve.
 *
 * Covered scenarios
 * -----------------
 * 1. Toggling ON  — passes source='nationwide-inquiry' to GET /api/v1/leads.
 * 2. Toggling OFF — drops the source param from the subsequent request.
 * 3. Saved-filter round-trip — saving with Nationwide active stores
 *    nationwideOnly:true in the POST body.
 * 4. aria-pressed reflects nationwideOnly state correctly.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

// ---------------------------------------------------------------------------
// Helpers — mirror the patterns from pipeline-server-search.test.tsx
// ---------------------------------------------------------------------------

/** All GET /api/v1/leads requests, parsed into their query params. */
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
    .filter(c => c.method === 'POST' && c.path.endsWith('/api/v1/saved-filters'));
}

const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Pipeline "Nationwide" filter', () => {
  afterEach(() => {
    cleanup();
  });

  // -------------------------------------------------------------------------
  // 1. Toggling ON passes source=nationwide-inquiry to the API
  // -------------------------------------------------------------------------
  it('passes source=nationwide-inquiry to the leads API when toggled ON', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Pipeline />);

    // Initial load: no source param.
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));
    expect(leadRequests(fetchMock)[0].source).toBeUndefined();

    fireEvent.click(screen.getByTestId('nationwide-filter'));

    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2));
    expect(leadRequests(fetchMock)[1].source).toBe('nationwide-inquiry');
  });

  // -------------------------------------------------------------------------
  // 2. Toggling OFF drops the source param
  // -------------------------------------------------------------------------
  it('drops the source param when toggled back OFF', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Pipeline />);

    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));

    const btn = screen.getByTestId('nationwide-filter');

    // ON
    fireEvent.click(btn);
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2));
    expect(leadRequests(fetchMock)[1].source).toBe('nationwide-inquiry');

    // OFF
    fireEvent.click(btn);
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(3));
    expect(leadRequests(fetchMock)[2].source).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Saved-filter round-trip stores nationwideOnly:true in the POST body
  // -------------------------------------------------------------------------
  it('stores nationwideOnly:true in the POST body when saving with the filter active', async () => {
    const fetchMock = mockApi('admin', {
      handler: (method, path) => {
        if (method === 'POST' && path.endsWith('/api/v1/saved-filters')) {
          return new Response(
            JSON.stringify({
              id: 'sf-nw-1',
              name: 'Nationwide leads',
              filters: { status: null, search: null, needsReply: null, nationwideOnly: true },
              organizationId: 'o1',
              createdAt: now,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return undefined;
      },
    });
    renderWithQuery(<Pipeline />);

    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));

    // Activate the Nationwide toggle
    fireEvent.click(screen.getByTestId('nationwide-filter'));
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2));

    // Open the save-filter popover and save
    fireEvent.click(screen.getByTestId('save-filter'));
    const input = await screen.findByPlaceholderText(/filter name/i);
    fireEvent.change(input, { target: { value: 'Nationwide leads' } });
    fireEvent.click(screen.getByRole('button', { name: /^save( filter)?$/i }));

    await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(1));

    const [call] = saveFilterCalls(fetchMock);
    const body = JSON.parse(String(call.body));
    expect(body).toMatchObject({
      name: 'Nationwide leads',
      filters: { nationwideOnly: true },
    });
  });

  // -------------------------------------------------------------------------
  // 4. aria-pressed reflects the nationwideOnly state
  // -------------------------------------------------------------------------
  it('aria-pressed on the toggle reflects nationwideOnly state', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Pipeline />);

    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));

    const btn = screen.getByTestId('nationwide-filter');

    // Starts OFF
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    // Toggle ON
    fireEvent.click(btn);
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2));
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    // Toggle OFF
    fireEvent.click(btn);
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(3));
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});
