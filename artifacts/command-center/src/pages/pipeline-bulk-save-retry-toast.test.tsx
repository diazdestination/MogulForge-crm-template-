/**
 * Covers the pipeline's "Could not save filter" toast: it must expose a Retry
 * action that re-sends the same payload; retry success dismisses the
 * destructive toast and shows the success toast, retry failure re-surfaces the
 * toast for another attempt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

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
    body: init?.body,
  };
}

function renderPipeline(handler?: (method: string, path: string) => Response | undefined) {
  const fetchMock = mockApi('admin', { handler });
  renderWithQuery(
    <>
      <Pipeline />
      <Toaster />
    </>,
  );
  return fetchMock;
}
const saveFilterCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(callInfo)
    .filter((c) => c.method === 'POST' && c.path.endsWith('/api/v1/saved-filters'));
async function triggerSaveFilter() {
  await screen.findAllByText(/hail damage roof/i);
  fireEvent.click(screen.getByTestId('save-filter'));
  const input = await screen.findByPlaceholderText(/filter name/i);
  fireEvent.change(input, { target: { value: 'My hot leads' } });
  // Accessible name is "Save" (aria-label) or "Save Filter" (visible text),
  // depending on whether the aria-label is present in the current markup.
  fireEvent.click(screen.getByRole('button', { name: /^save( filter)?$/i }));
}

describe('Pipeline save-filter retry toast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('retries saving the filter with the same payload and dismisses on success', async () => {
    let fail = true;
    const fetchMock = renderPipeline((method, path) => {
      if (method === 'POST' && path.endsWith('/api/v1/saved-filters')) {
        return fail ? jsonResponse({ error: 'boom' }, 500) : jsonResponse({ id: 'sf-1', name: 'My hot leads', filters: { status: null, search: null, needsReply: null }, organizationId: 'o1', createdAt: new Date().toISOString() });
      }
      return undefined;
    });

    await triggerSaveFilter();

    await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(1));
    await waitFor(() => expect(screen.getByText(/could not save filter/i)).toBeTruthy());
    const retry = await screen.findByRole('button', { name: /retry/i });

    fail = false;
    fireEvent.click(retry);

    await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(2));
    const [first, second] = saveFilterCalls(fetchMock);
    expect(JSON.parse(String(second.body))).toEqual(JSON.parse(String(first.body)));
    expect(JSON.parse(String(second.body))).toMatchObject({
      name: 'My hot leads',
      filters: { status: null, search: null },
    });

    await waitFor(() => expect(screen.getByText(/filter saved/i)).toBeTruthy());
    expect(screen.queryByText(/could not save filter/i)).toBeNull();
  });

  it('re-surfaces the toast when the save-filter retry fails again', async () => {
    const fetchMock = renderPipeline((method, path) => {
      if (method === 'POST' && path.endsWith('/api/v1/saved-filters')) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerSaveFilter();

    await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(1));
    await waitFor(() => expect(screen.getByText(/could not save filter/i)).toBeTruthy());
    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(saveFilterCalls(fetchMock).length).toBe(2));

    // The toast (with its Retry action) is still there for another attempt.
    await waitFor(() => expect(screen.getByText(/could not save filter/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
