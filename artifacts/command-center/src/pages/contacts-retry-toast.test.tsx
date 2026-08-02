/**
 * Covers the contacts page's error toast for the one-shot delete mutation: a
 * failed delete must surface a toast with a Retry action; retry success
 * dismisses the toast and refreshes the contact list, and a failed retry
 * re-surfaces the toast. (Same pattern as tasks-retry-toast.test.tsx.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Contacts from '@/pages/contacts';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi, sampleContact } from '@/test/mock-api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function callInfo([input, init]: [RequestInfo | URL, RequestInit?]) {
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: String(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    ).split('?')[0],
  };
}

function renderContacts(handler?: (method: string, path: string) => Response | undefined) {
  vi.stubGlobal('confirm', vi.fn(() => true));
  const fetchMock = mockApi('admin', { handler });
  renderWithQuery(
    <>
      <Contacts />
      <Toaster />
    </>,
  );
  return fetchMock;
}

const deleteCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(callInfo)
    .filter(c => c.method === 'DELETE' && c.path.endsWith(`/api/v1/contacts/${sampleContact.id}`));

const listCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(callInfo)
    .filter(c => c.method === 'GET' && c.path.endsWith('/api/v1/contacts'));

async function triggerDelete() {
  // The page renders mobile cards and a desktop table; both show the contact.
  await screen.findAllByText(/jane homeowner/i);
  fireEvent.click(screen.getAllByTestId('delete-contact')[0]);
}

describe('Contacts delete retry toast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a toast with Retry when the delete fails', async () => {
    const fetchMock = renderContacts((method, path) => {
      if (method === 'DELETE' && path.endsWith(`/api/v1/contacts/${sampleContact.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerDelete();

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/contact not deleted/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('retries from the toast, dismisses it, and refreshes the list on success', async () => {
    let fail = true;
    const fetchMock = renderContacts((method, path) => {
      if (method === 'DELETE' && path.endsWith(`/api/v1/contacts/${sampleContact.id}`)) {
        if (fail) return jsonResponse({ error: 'boom' }, 500);
        return new Response(null, { status: 204 });
      }
      return undefined;
    });

    await triggerDelete();

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });
    const listCallsBefore = listCalls(fetchMock).length;

    fail = false;
    fireEvent.click(retry);

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(2));

    // Success dismisses the toast and invalidates the contact list.
    await waitFor(() => {
      expect(screen.queryByText(/contact not deleted/i)).toBeNull();
    });
    await waitFor(() => expect(listCalls(fetchMock).length).toBeGreaterThan(listCallsBefore));
  });

  it('re-surfaces the toast when the retry fails again', async () => {
    const fetchMock = renderContacts((method, path) => {
      if (method === 'DELETE' && path.endsWith(`/api/v1/contacts/${sampleContact.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerDelete();

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(2));

    // The toast (with its Retry action) is still there for another attempt.
    expect(screen.getByText(/contact not deleted/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
