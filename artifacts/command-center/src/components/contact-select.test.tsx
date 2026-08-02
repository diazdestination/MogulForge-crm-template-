/**
 * Covers the shared searchable contact picker (ContactSelect): typing is
 * debounced into a single server-side `search`/`limit` request, options are
 * capped at 50 with a "more matches" hint when the server returns the extra
 * probe row, and a selected contact's label stays visible even after the
 * search results no longer include it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import ContactSelect from '@/components/contact-select';
import { renderWithQuery } from '@/test/render';
import { mockApi, sampleContact } from '@/test/mock-api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** All GET /api/v1/contacts requests, parsed into their query params. */
function contactRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input, init]: [RequestInfo | URL, RequestInit?]) => {
      const raw = String(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const method = (init?.method ?? 'GET').toUpperCase();
      return { raw, method };
    })
    .filter(c => c.method === 'GET' && c.raw.split('?')[0].endsWith('/api/v1/contacts'))
    .map(c => Object.fromEntries(new URL(c.raw, 'http://test.local').searchParams.entries()));
}

function makeContacts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...sampleContact,
    id: `ct-${String(i).padStart(4, '0')}`,
    firstName: 'Contact',
    lastName: `${i}`,
  }));
}

function Harness(props: { initial?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return <ContactSelect value={value} onChange={setValue} />;
}

describe('ContactSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('debounces typing into a single server search request with search + limit params', async () => {
    const fetchMock = mockApi('admin');
    renderWithQuery(<Harness />);

    // Initial load: no search param, limit = cap + 1 probe row.
    await waitFor(() => expect(contactRequests(fetchMock).length).toBe(1));
    expect(contactRequests(fetchMock)[0]).toEqual({ limit: '51' });

    const input = screen.getByTestId('contact-select-search');
    fireEvent.change(input, { target: { value: 'ja' } });
    fireEvent.change(input, { target: { value: 'jan' } });
    fireEvent.change(input, { target: { value: 'jane' } });

    // Intermediate keystrokes never reach the server; only the settled value does.
    await waitFor(() => expect(contactRequests(fetchMock).length).toBe(2), { timeout: 2000 });
    await new Promise(r => setTimeout(r, 400));
    const requests = contactRequests(fetchMock);
    expect(requests.length).toBe(2);
    expect(requests[1]).toEqual({ search: 'jane', limit: '51' });
  });

  it('caps the options at 50 and shows the "more matches" hint when the server returns 51 rows', async () => {
    mockApi('admin', {
      handler: (method, path) => {
        if (method === 'GET' && path.endsWith('/api/v1/contacts')) {
          return jsonResponse(makeContacts(51));
        }
        return undefined;
      },
    });
    renderWithQuery(<Harness />);

    await screen.findByText(/more matches exist/i);
    const select = screen.getByTestId('contact-select');
    const options = within(select).getAllByRole('option');
    // 50 contacts + the empty "-- None --" option.
    expect(options.length).toBe(51);
    expect(within(select).queryByText('Contact 50')).toBeNull();
  });

  it('keeps the selected contact label visible when search results no longer include it', async () => {
    // Search-aware stub: the empty-search load returns Jane; any searched
    // request returns no rows, so the selected contact drops out of the results.
    const fetchMock = mockApi('admin');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const raw = String(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const url = new URL(raw, 'http://test.local');
      if (url.pathname.endsWith('/api/v1/contacts')) {
        return url.searchParams.get('search')
          ? jsonResponse([])
          : jsonResponse([{ ...sampleContact, id: 'jane-contact' }]);
      }
      if (url.pathname.endsWith('/api/v1/me')) {
        return jsonResponse({ id: 'u1', role: 'admin' });
      }
      return jsonResponse([]);
    });

    renderWithQuery(<Harness />);

    const select = screen.getByTestId('contact-select');
    await waitFor(() => expect(within(select).queryByText('Jane Homeowner')).toBeTruthy());
    fireEvent.change(select, { target: { value: 'jane-contact' } });
    expect((select as HTMLSelectElement).value).toBe('jane-contact');

    // Search for something that excludes the selected contact.
    fireEvent.change(screen.getByTestId('contact-select-search'), { target: { value: 'zzz' } });
    await screen.findByText(/no contacts match "zzz"/i, undefined, { timeout: 2000 });

    // The selected contact's label is still rendered and still selected.
    expect((select as HTMLSelectElement).value).toBe('jane-contact');
    expect(within(select).getByText('Jane Homeowner')).toBeTruthy();
  });
});
