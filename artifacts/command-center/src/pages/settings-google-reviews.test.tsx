/**
 * GoogleReviewsTab in the Settings page must:
 *  - pre-populate the Place ID and API key from the current org settings;
 *  - send the correct payload to updateSettings (PUT /v1/settings) when
 *    the admin fills in the fields and clicks Save;
 *  - show the success toast after the mutation completes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Settings from '@/pages/settings';
import { Toaster } from '@/components/ui/toaster';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    organizationId: 'o1',
    businessProfile: {},
    services: [],
    serviceAreas: [],
    securityAlertsAcknowledgedAt: null,
    googleReviews: null,
    ...overrides,
  };
}

function renderSettings(settingsOverrides: Record<string, unknown> = {}) {
  let currentSettings = makeSettings(settingsOverrides);
  const fetchMock = mockApi('admin', {
    handler: (method, path, _rawUrl) => {
      if (path.endsWith('/api/v1/settings')) {
        if (method === 'PUT') {
          // Mirror what the server would persist so refetch picks it up.
          return json(currentSettings);
        }
        return json(currentSettings);
      }
      if (path.endsWith('/api/v1/audit-events')) return json([]);
      if (path.endsWith('/api/v1/webhooks')) return json([]);
      if (path.endsWith('/api/v1/api-keys')) return json([]);
      if (path.endsWith('/api/v1/tags')) return json([]);
      if (path.endsWith('/api/v1/users')) return json([]);
      return undefined;
    },
  });

  // Capture PUT bodies so assertions can inspect the exact payload.
  const putBodies: unknown[] = [];
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (raw.split('?')[0].endsWith('/api/v1/settings') && method === 'PUT') {
      if (init?.body) {
        const parsed = JSON.parse(init.body as string) as unknown;
        putBodies.push(parsed);
        currentSettings = makeSettings(
          (parsed as { googleReviews?: unknown }).googleReviews !== undefined
            ? { googleReviews: (parsed as { googleReviews: unknown }).googleReviews }
            : {},
        );
      }
    }
    return original(input, init);
  });

  renderWithQuery(<Settings />);
  return { fetchMock, putBodies };
}

async function openGoogleReviewsTab() {
  const tab = await screen.findByRole('tab', { name: /google reviews/i });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe('GoogleReviewsTab', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the Place ID and API key fields', async () => {
    renderSettings();
    await openGoogleReviewsTab();

    expect(await screen.findByLabelText(/place id/i)).toBeTruthy();
    expect(screen.getByLabelText(/places api key/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /save google reviews settings/i })).toBeTruthy();
  });

  it('pre-populates the fields from the current org settings', async () => {
    renderSettings({
      googleReviews: { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', apiKey: 'AIzaFAKE' },
    });
    await openGoogleReviewsTab();

    const placeIdInput = await screen.findByLabelText(/place id/i);
    expect((placeIdInput as HTMLInputElement).value).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');

    const apiKeyInput = screen.getByLabelText(/places api key/i);
    expect((apiKeyInput as HTMLInputElement).value).toBe('AIzaFAKE');
  });

  it('sends the correct payload when the admin fills in Place ID + API key and clicks Save', async () => {
    const { putBodies } = renderSettings();
    await openGoogleReviewsTab();

    const placeIdInput = await screen.findByLabelText(/place id/i);
    const apiKeyInput = screen.getByLabelText(/places api key/i);

    fireEvent.change(placeIdInput, { target: { value: 'ChIJN1t_tDeuEmsRUsoyG83frY4' } });
    fireEvent.change(apiKeyInput, { target: { value: 'AIzaTESTKEY' } });

    const saveBtn = screen.getByRole('button', { name: /save google reviews settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
    });

    const body = putBodies[putBodies.length - 1] as {
      googleReviews: { placeId?: string; apiKey?: string };
    };
    expect(body.googleReviews).toBeDefined();
    expect(body.googleReviews.placeId).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(body.googleReviews.apiKey).toBe('AIzaTESTKEY');
  });

  it('trims whitespace before sending', async () => {
    const { putBodies } = renderSettings();
    await openGoogleReviewsTab();

    const placeIdInput = await screen.findByLabelText(/place id/i);
    const apiKeyInput = screen.getByLabelText(/places api key/i);

    fireEvent.change(placeIdInput, { target: { value: '  ChIJABC  ' } });
    fireEvent.change(apiKeyInput, { target: { value: '  AIzaTRIMMED  ' } });

    fireEvent.click(screen.getByRole('button', { name: /save google reviews settings/i }));

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
    });

    const body = putBodies[putBodies.length - 1] as {
      googleReviews: { placeId?: string; apiKey?: string };
    };
    expect(body.googleReviews.placeId).toBe('ChIJABC');
    expect(body.googleReviews.apiKey).toBe('AIzaTRIMMED');
  });

  it('sends googleReviews as an object with undefined values when both fields are blank', async () => {
    const { putBodies } = renderSettings();
    await openGoogleReviewsTab();

    // Ensure fields are empty (default state)
    await screen.findByLabelText(/place id/i);

    fireEvent.click(screen.getByRole('button', { name: /save google reviews settings/i }));

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
    });

    const body = putBodies[putBodies.length - 1] as { googleReviews: unknown };
    // googleReviews key must be present (so the server knows to bust the cache)
    expect(Object.prototype.hasOwnProperty.call(body, 'googleReviews')).toBe(true);
  });

  it('sends apiKey as undefined when admin focuses the masked field, leaves it empty, and clicks Save', async () => {
    // Simulate the server returning a masked key (key is saved but not readable).
    const maskedKey = 'AIza••••5678';
    const { putBodies } = renderSettings({
      googleReviews: { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', apiKey: maskedKey },
    });
    await openGoogleReviewsTab();

    const apiKeyInput = await screen.findByLabelText(/places api key/i);

    // Step 1: Admin focuses the field — mask is cleared to let them type a new key.
    fireEvent.focus(apiKeyInput);
    expect((apiKeyInput as HTMLInputElement).value).toBe('');

    // Step 2: Admin does NOT type anything, then clicks Save.
    // Browser fires mousedown → blur → click; replicate that exact order so the
    // savePressedRef guard has a chance to prevent the blur from restoring the mask.
    const saveBtn = screen.getByRole('button', { name: /save google reviews settings/i });
    fireEvent.mouseDown(saveBtn);
    fireEvent.blur(apiKeyInput);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
    });

    const body = putBodies[putBodies.length - 1] as {
      googleReviews: { placeId?: string; apiKey?: string };
    };
    // apiKey must be absent/undefined — not the sentinel — so the server removes the stored key.
    expect(body.googleReviews.apiKey).toBeUndefined();
  });

  it('shows a success toast after saving', async () => {
    // Toaster must be in the tree for toast messages to render.
    const fetchMock = mockApi('admin', {
      handler: (method, path) => {
        if (path.endsWith('/api/v1/settings')) return json(makeSettings());
        if (path.endsWith('/api/v1/audit-events')) return json([]);
        if (path.endsWith('/api/v1/webhooks')) return json([]);
        if (path.endsWith('/api/v1/api-keys')) return json([]);
        if (path.endsWith('/api/v1/tags')) return json([]);
        if (path.endsWith('/api/v1/users')) return json([]);
        return undefined;
      },
    });
    void fetchMock;
    renderWithQuery(
      <>
        <Settings />
        <Toaster />
      </>,
    );
    await openGoogleReviewsTab();

    await screen.findByLabelText(/place id/i);

    fireEvent.click(screen.getByRole('button', { name: /save google reviews settings/i }));

    await screen.findByText(/google reviews settings saved/i);
  });
});
