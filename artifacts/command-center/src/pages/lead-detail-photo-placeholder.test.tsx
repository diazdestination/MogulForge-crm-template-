/**
 * Locks in that a damage-photo thumbnail whose file fails to load (e.g.
 * storage 404) renders a tidy "Photo unavailable" placeholder instead of a
 * browser broken-image icon, and that failed photos are excluded from the
 * lightbox so it never opens on a broken slide.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LeadDetail from './lead-detail';
import { mockApi, sampleContact, sampleLead } from '@/test/mock-api';
import { renderWithQuery } from '@/test/render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const activity = {
  id: 'act-1',
  type: 'portal_message',
  title: 'Homeowner sent photos',
  body: 'Here are the damage photos',
  occurredAt: new Date().toISOString(),
  metadata: { photoPaths: ['/objects/photos/good.jpg', '/objects/photos/missing.jpg'] },
};

function setup() {
  mockApi('sales_rep', {
    handler: (method, path) => {
      if (method === 'GET' && path.endsWith(`/api/v1/leads/${sampleLead.id}/activities`)) {
        return new Response(JSON.stringify([activity]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (method === 'GET' && path.endsWith(`/api/v1/leads/${sampleLead.id}`)) {
        return new Response(JSON.stringify({ ...sampleLead, contactId: sampleContact.id, scoreReasons: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (method === 'GET' && path.endsWith(`/api/v1/contacts/${sampleContact.id}`)) {
        return new Response(JSON.stringify(sampleContact), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return undefined;
    },
  });

  const { hook } = memoryLocation({ path: `/leads/${sampleLead.id}` });
  return renderWithQuery(
    <Router hook={hook}>
      <Route path="/leads/:id" component={LeadDetail} />
    </Router>,
  );
}

describe('lead timeline damage-photo placeholder', () => {
  it('shows a styled placeholder when a photo fails to load and keeps it out of the lightbox', async () => {
    setup();
    await screen.findByText('Homeowner sent photos');

    // Both thumbnails render initially.
    const thumbs = await screen.findAllByAltText('Damage photo attached by homeowner');
    expect(thumbs).toHaveLength(2);

    // The second photo's file is missing — the <img> errors out.
    fireEvent.error(thumbs[1]);

    // A tidy placeholder replaces the broken image.
    const placeholder = await screen.findByTestId('photo-unavailable-placeholder');
    expect(placeholder.textContent).toMatch(/photo unavailable/i);

    // The failed photo is no longer a clickable thumbnail.
    expect(screen.getAllByAltText('Damage photo attached by homeowner')).toHaveLength(1);
    expect(placeholder.closest('button')).toBeNull();

    // Opening the surviving photo shows a 1-photo lightbox (failed one excluded).
    fireEvent.click(screen.getByLabelText('Open photo in full-size viewer'));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /photo 1 of 1/i })).toBeTruthy();
    });
  });
});
