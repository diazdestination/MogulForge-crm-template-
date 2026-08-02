/**
 * Covers the settings Team tab's retry toast for the one-shot resend-invite
 * action: both a thrown request error and a `sent: false` response must
 * surface a toast with a Retry action, and a successful retry dismisses it.
 * A 429 Retry-After response shows a friendly cooldown notice instead of
 * the destructive retry toast.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Settings from '@/pages/settings';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

const inviteUser = {
  id: 'invite:pending@example.com',
  email: 'pending@example.com',
  firstName: 'Pending',
  lastName: 'Invitee',
  role: 'sales_rep',
  isActive: true,
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

const resendPath = `/api/v1/users/${inviteUser.id}/resend-invite`;

function renderTeamSettings(handler: (method: string, path: string) => Response | undefined) {
  const fetchMock = mockApi('admin', {
    handler: (method, path) => {
      if (method === 'GET' && path.endsWith('/api/v1/settings')) return jsonResponse({});
      if (method === 'GET' && path.endsWith('/api/v1/users')) return jsonResponse([inviteUser]);
      return handler(method, path);
    },
  });
  renderWithQuery(
    <>
      <Settings />
      <Toaster />
    </>,
  );
  return fetchMock;
}

const resendCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([input, init]) => {
    const url = String(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    ).split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();
    return method === 'POST' && url.endsWith(resendPath);
  });

async function openTeamTabAndResend() {
  const teamTab = await screen.findByRole('tab', { name: /team/i });
  fireEvent.mouseDown(teamTab);
  fireEvent.click(teamTab);
  const resend = await screen.findByTestId(`button-resend-invite-${inviteUser.id}`);
  fireEvent.click(resend);
}

describe('Settings resend-invite retry toast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows an error toast with a Retry action when the resend request fails', async () => {
    const fetchMock = renderTeamSettings((method, path) => {
      if (method === 'POST' && path.endsWith(resendPath)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await openTeamTabAndResend();

    await waitFor(() => expect(resendCalls(fetchMock).length).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/could not re-send the invite email/i)).toBeTruthy();
    });
    // Shows a retry action so the rep can try again.
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    // Cooldown message must not appear — this is a plain failure, not a 429.
    expect(screen.queryByText(/invite was just resent/i)).toBeNull();
  });

  it('shows a cooldown toast (not a retry) when the server says the invite was just resent', async () => {
    // 429 with a Retry-After header triggers the friendly "just resent" cooldown UI.
    renderTeamSettings((method, path) => {
      if (method === 'POST' && path.endsWith(resendPath)) {
        return jsonResponse({ error: 'Too Many Requests' }, 429, { 'retry-after': '42' });
      }
      return undefined;
    });

    await openTeamTabAndResend();

    await waitFor(() => {
      expect(screen.getByText(/invite was just resent/i)).toBeTruthy();
    });
    expect(screen.getByText(/about 42 seconds/i)).toBeTruthy();
    // Shows a cooldown notice, not a failure — no retry action.
    expect(screen.queryByText(/could not re-send the invite email/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('shows a Retry toast when the email is not delivered (sent: false), and retry success dismisses it', async () => {
    let fail = true;
    const fetchMock = renderTeamSettings((method, path) => {
      if (method === 'POST' && path.endsWith(resendPath)) {
        if (fail) return jsonResponse({ sent: false, error: 'Delivery failed' });
        return jsonResponse({ sent: true });
      }
      return undefined;
    });

    await openTeamTabAndResend();

    await waitFor(() => expect(resendCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });

    fail = false;
    fireEvent.click(retry);

    await waitFor(() => expect(resendCalls(fetchMock).length).toBe(2));
    // Wait for the toast to disappear — use queryAllByText to avoid false failures
    // from the aria-live region that mirrors the toast title.
    await waitFor(() => {
      const nodes = screen.queryAllByText(/could not re-send the invite email/i);
      const visibleToasts = nodes.filter(el => !el.closest('[aria-live]'));
      expect(visibleToasts).toHaveLength(0);
    });
  });

  it('re-surfaces the toast when the retry fails again', async () => {
    const fetchMock = renderTeamSettings((method, path) => {
      if (method === 'POST' && path.endsWith(resendPath)) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      return undefined;
    });

    await openTeamTabAndResend();

    await waitFor(() => expect(resendCalls(fetchMock).length).toBe(1));
    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(resendCalls(fetchMock).length).toBe(2));

    // The toast (with its Retry action) is still there for another attempt.
    expect(screen.getByText(/could not re-send the invite email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
