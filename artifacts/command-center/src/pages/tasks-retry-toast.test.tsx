/**
 * Covers the tasks page's error toast for one-shot mutations: a failed
 * status toggle must surface a toast with a Retry action; retry success
 * dismisses the toast and refreshes the task list, and a failed retry
 * re-surfaces the toast. (Same pattern as pipeline-retry-toast.test.tsx.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Tasks from '@/pages/tasks';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi, sampleTask } from '@/test/mock-api';

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

function renderTasks(handler?: (method: string, path: string) => Response | undefined) {
  const fetchMock = mockApi('admin', { handler });
  renderWithQuery(
    <>
      <Tasks />
      <Toaster />
    </>,
  );
  return fetchMock;
}

const patchCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .map(callInfo)
    .filter(c => c.method === 'PATCH' && c.path.endsWith(`/api/v1/tasks/${sampleTask.id}`));

async function triggerStatusToggle() {
  // The page renders mobile cards and a desktop table; both show the task.
  await screen.findAllByText(/call the adjuster/i);
  fireEvent.click(screen.getAllByTestId('toggle-task-status')[0]);
}

describe('Tasks status-toggle retry toast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a toast with Retry when the toggle fails', async () => {
    const fetchMock = renderTasks((method, path) => {
      if (method === 'PATCH' && path.endsWith(`/api/v1/tasks/${sampleTask.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerStatusToggle();

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/task not updated/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('retries from the toast and dismisses it on success', async () => {
    let fail = true;
    const fetchMock = renderTasks((method, path) => {
      if (fail && method === 'PATCH' && path.endsWith(`/api/v1/tasks/${sampleTask.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      if (method === 'PATCH' && path.endsWith(`/api/v1/tasks/${sampleTask.id}`)) {
        return jsonResponse({ ...sampleTask, status: 'done' });
      }
      return undefined;
    });

    await triggerStatusToggle();

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });

    fail = false;
    fireEvent.click(retry);

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(2));
    expect(JSON.parse(String(patchCalls(fetchMock)[1].body))).toMatchObject({
      status: 'done',
    });

    // Success dismisses the toast.
    await waitFor(() => {
      expect(screen.queryByText(/task not updated/i)).toBeNull();
    });
  });

  it('re-surfaces the toast when the retry fails again', async () => {
    const fetchMock = renderTasks((method, path) => {
      if (method === 'PATCH' && path.endsWith(`/api/v1/tasks/${sampleTask.id}`)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await triggerStatusToggle();

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(patchCalls(fetchMock).length).toBe(2));

    // The toast (with its Retry action) is still there for another attempt.
    expect(screen.getByText(/task not updated/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
