/**
 * Covers that the Pipeline page searches leads server-side: typing in the
 * search box is debounced into a `search` query param on the leads API
 * request instead of filtering the already-downloaded list client-side.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

/** All GET /api/v1/leads requests, parsed into their query params. */
function leadRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input, init]: [RequestInfo | URL, RequestInit?]) => {
      const raw = String(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const method = (init?.method ?? 'GET').toUpperCase();
      return { raw, method };
    })
    .filter(c => c.method === 'GET' && c.raw.split('?')[0].endsWith('/api/v1/leads'))
    .map(c => Object.fromEntries(new URL(c.raw, 'http://test.local').searchParams.entries()));
}

describe('Pipeline server-side lead search', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes the debounced search term to the leads API instead of filtering client-side', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Pipeline />);

    // Initial load: no search param.
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));
    expect(leadRequests(fetchMock)[0].search).toBeUndefined();

    const input = screen.getByPlaceholderText('Search leads...');
    fireEvent.change(input, { target: { value: 'ha' } });
    fireEvent.change(input, { target: { value: 'hail' } });

    // Only the settled term hits the server, as a `search` query param.
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2), { timeout: 2000 });
    await new Promise(r => setTimeout(r, 400));
    const requests = leadRequests(fetchMock);
    expect(requests.length).toBe(2);
    expect(requests[1].search).toBe('hail');
  });

  it('drops the search param again when the box is cleared', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Pipeline />);
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(1));

    const input = screen.getByPlaceholderText('Search leads...');
    fireEvent.change(input, { target: { value: 'hail' } });
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(2), { timeout: 2000 });

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(leadRequests(fetchMock).length).toBe(3), { timeout: 2000 });
    expect(leadRequests(fetchMock)[2].search).toBeUndefined();
  });
});
