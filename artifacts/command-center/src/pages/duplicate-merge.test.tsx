/**
 * Locks in that the pipeline's duplicate badge only opens the merge dialog
 * for users who can write, and covers the happy-path merge flow: pick a
 * survivor, confirm, POST /v1/leads/{id}/merge fires, and the lead +
 * duplicate queries are refetched.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Pipeline from './pipeline';
import { mockApi, sampleLead } from '@/test/mock-api';
import { renderWithQuery } from '@/test/render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const leadA = { ...sampleLead, id: 'aaaaaaaa-0000', summary: 'Hail damage roof' };
const leadB = { ...sampleLead, id: 'bbbbbbbb-0000', summary: 'Hail damage roof again' };

const duplicateGroup = {
  field: 'phone',
  value: '555-0100',
  leadIds: [leadA.id, leadB.id],
};

const sampleDialogContact = {
  id: 'c9-00000000',
  firstName: 'Jane',
  lastName: 'Homeowner',
  email: 'jane@example.com',
  phone: '555-0100',
  createdAt: new Date().toISOString(),
};

function mockDuplicateApi(role: string, onMerge?: (path: string, body: unknown) => void) {
  return mockApi(role, {
    handler: (method, path) => {
      if (path.endsWith('/api/v1/leads/duplicates')) {
        return new Response(JSON.stringify([duplicateGroup]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (method === 'POST' && path.endsWith('/merge')) {
        onMerge?.(path, undefined);
        return new Response(JSON.stringify(leadA), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (method === 'GET' && (path.endsWith(`/api/v1/leads/${leadA.id}`) || path.endsWith(`/api/v1/leads/${leadB.id}`))) {
        const lead = path.endsWith(leadA.id) ? leadA : leadB;
        return new Response(JSON.stringify({ ...lead, contactId: sampleDialogContact.id }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (method === 'GET' && path.endsWith(`/api/v1/contacts/${sampleDialogContact.id}`)) {
        return new Response(JSON.stringify(sampleDialogContact), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (path.endsWith('/api/v1/leads')) {
        return new Response(JSON.stringify([leadA, leadB]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return undefined;
    },
  });
}

describe('pipeline duplicate badge role gating', () => {
  it('viewer: badge renders but is not clickable and never opens the merge dialog', async () => {
    mockDuplicateApi('viewer');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');

    // Badge shows for the duplicate leads, but as a plain span, not a button.
    const badges = await screen.findAllByText('Dup');
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge.closest('button')).toBeNull();
    }

    // Clicking it does nothing — the merge dialog never appears.
    fireEvent.click(badges[0]);
    expect(screen.queryByText('Resolve duplicate leads')).toBeNull();
  });

  it('sales_rep: badge is a button and opens the merge dialog', async () => {
    mockDuplicateApi('sales_rep');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');

    const badges = await screen.findAllByText('Dup');
    const button = badges[0].closest('button');
    expect(button).not.toBeNull();

    fireEvent.click(button!);
    await screen.findByText('Resolve duplicate leads');
  });
});

describe('merge happy path', () => {
  it('pick survivor, confirm, merge fires and lead/duplicate queries are refetched', async () => {
    const mergeCalls: string[] = [];
    const fetchMock = mockDuplicateApi('sales_rep', path => mergeCalls.push(path));
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');

    // Open the dialog from the duplicate badge.
    const badges = await screen.findAllByText('Dup');
    fireEvent.click(badges[0].closest('button')!);
    const dialog = (await screen.findByText('Resolve duplicate leads')).closest('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();

    // Wait for both comparison cards to load, then pick lead A as survivor.
    const survivorCard = await waitFor(() => {
      const el = within(dialog).getByText(leadA.id.substring(0, 8)).closest('button');
      if (!el) throw new Error('survivor card not ready');
      return el;
    });
    fireEvent.click(survivorCard);
    expect(survivorCard.getAttribute('aria-pressed')).toBe('true');

    // Two-step confirm.
    fireEvent.click(within(dialog).getByText('Merge duplicates…'));
    const confirmBtn = await within(dialog).findByText('Confirm merge');

    const listCallsBefore = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      return url.split('?')[0].endsWith('/api/v1/leads') || url.split('?')[0].endsWith('/api/v1/leads/duplicates');
    }).length;

    fireEvent.click(confirmBtn);

    // Merge mutation fired against the survivor with the duplicate as source.
    await waitFor(() => expect(mergeCalls.length).toBe(1));
    expect(mergeCalls[0]).toContain(`/api/v1/leads/${leadA.id}/merge`);
    const mergeRequest = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      return url.includes('/merge') && (init?.method ?? 'GET').toUpperCase() === 'POST';
    });
    expect(mergeRequest).toBeDefined();
    expect(JSON.parse(String(mergeRequest![1]?.body))).toEqual({ sourceLeadId: leadB.id });

    // Dialog closes and lead + duplicate queries are invalidated (refetched).
    await waitFor(() => expect(screen.queryByText('Resolve duplicate leads')).toBeNull());
    await waitFor(() => {
      const listCallsAfter = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        return url.split('?')[0].endsWith('/api/v1/leads') || url.split('?')[0].endsWith('/api/v1/leads/duplicates');
      }).length;
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore);
    });
  });
});
