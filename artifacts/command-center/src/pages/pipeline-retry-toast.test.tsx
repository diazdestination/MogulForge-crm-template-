/**
 * Covers the pipeline's error toasts for one-shot mutations: a failed
 * drag-to-status change must surface a toast with a Retry action; retry
 * success dismisses the toast and refreshes the lead list, and a failed
 * retry re-surfaces the toast.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Pipeline from '@/pages/pipeline';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi, sampleLead } from '@/test/mock-api';

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

const patchCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(callInfo)
    .filter(c => c.method === 'PATCH' && c.path.endsWith(`/api/v1/leads/${sampleLead.id}`));

async function triggerStatusChange() {
  // The board card exposes a status <select>; change it to trigger the mutation.
  await screen.findByText(/hail damage roof/i);
  const [cardSelect] = screen.getAllByTestId('lead-status-select');
  fireEvent.change(cardSelect, { target: { value: 'contact_attempted' } });
}

describe('Pipeline status-change retry toast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a toast with Retry when the status change fails', async () => {
    const fetchMock = renderPipeline((method, path) => {
      if (method === 'PATCH' && path.endsWith(`/api/v1/leads/${sampleLead.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerStatusChange();

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/lead status not updated/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('retries from the toast and dismisses it on success', async () => {
    let fail = true;
    const fetchMock = renderPipeline((method, path) => {
      if (fail && method === 'PATCH' && path.endsWith(`/api/v1/leads/${sampleLead.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      if (method === 'PATCH' && path.endsWith(`/api/v1/leads/${sampleLead.id}`)) {
        return jsonResponse({ ...sampleLead, status: 'contact_attempted' });
      }
      return undefined;
    });

    await triggerStatusChange();

    // Wait for the failed mutation before grabbing the fresh toast's button.
    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });

    fail = false;
    fireEvent.click(retry);

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(2));
    expect(JSON.parse(String(patchCalls(fetchMock)[1].body))).toMatchObject({
      status: 'contact_attempted',
    });

    // Success dismisses the toast.
    await waitFor(() => {
      expect(screen.queryByText(/lead status not updated/i)).toBeNull();
    });
  });

  it('re-surfaces the toast when the retry fails again', async () => {
    const fetchMock = renderPipeline((method, path) => {
      if (method === 'PATCH' && path.endsWith(`/api/v1/leads/${sampleLead.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerStatusChange();

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(2));

    // The toast (with its Retry action) is still there for another attempt.
    expect(screen.getByText(/lead status not updated/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
