/**
 * Regression: history hydration must not overwrite in-flight conversation state.
 *
 * The assistant page fetches history from the server on mount. If a user could
 * send a message before that fetch resolved, the late setMessages(loaded) call
 * would clobber the [userMsg, assistantStub] pair already in state.
 *
 * Fix: the send UI (button, textarea, suggestion cards) is disabled until
 * `historyLoaded` is true, preventing any submission before hydration completes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Assistant from '@/pages/assistant';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Render the assistant page with a controllable history endpoint. */
function renderAssistant({
  historyResponse,
}: {
  historyResponse: Promise<Response>;
}) {
  const fetchMock = mockApi('sales_rep', {
    handler: (method, path) => {
      if (method === 'GET' && path.endsWith('/api/v1/assistant/history')) {
        // Return the caller-controlled promise so tests can delay resolution.
        return historyResponse as unknown as Response;
      }
      if (method === 'POST' && path.endsWith('/api/v1/assistant/history')) {
        return jsonResponse({ messages: [] });
      }
      return undefined;
    },
  });
  renderWithQuery(<Assistant />);
  return fetchMock;
}

describe('Assistant page — history hydration race guard', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('send button is disabled while history is loading', async () => {
    // Never resolves during this test — simulates a slow history fetch.
    const historyResponse = new Promise<Response>(() => {});
    renderAssistant({ historyResponse });

    // The send button must be in the document and disabled.
    const sendBtn = await screen.findByRole('button', { name: /send message/i });
    expect(sendBtn).toHaveProperty('disabled', true);
  });

  it('send button becomes enabled once history resolves', async () => {
    let resolve!: (r: Response) => void;
    const historyResponse = new Promise<Response>((res) => { resolve = res; });
    renderAssistant({ historyResponse });

    // Initially disabled.
    const sendBtn = await screen.findByRole('button', { name: /send message/i });
    expect(sendBtn).toHaveProperty('disabled', true);

    // Resolve the history fetch with an empty history.
    resolve(jsonResponse({ messages: [] }));

    // Now the button should be re-enabled (still disabled because input is
    // empty, but the historyLoaded flag no longer blocks it).
    // Type something so the button's own "empty input" guard is cleared.
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });

    await waitFor(() => {
      expect(sendBtn).toHaveProperty('disabled', false);
    });
  });

  it('suggestion cards are disabled while history is loading', async () => {
    const historyResponse = new Promise<Response>(() => {});
    renderAssistant({ historyResponse });

    // Suggestion cards are rendered in the empty-state view.
    const suggestions = await screen.findAllByRole('button', {
      name: /close rate|conversion|missed|overloaded|appointments|revenue/i,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const btn of suggestions) {
      expect(btn).toHaveProperty('disabled', true);
    }
  });

  it('history loaded from server populates messages', async () => {
    const savedMessages = [
      { role: 'user', content: 'How are leads doing?' },
      { role: 'assistant', content: 'Pipeline looks healthy.', toolsRun: [] },
    ];
    const historyResponse = Promise.resolve(jsonResponse({ messages: savedMessages }));
    renderAssistant({ historyResponse });

    // After history loads, prior messages should appear in the chat.
    await waitFor(() => {
      expect(screen.getByText('How are leads doing?')).toBeTruthy();
    });
    expect(screen.getByText('Pipeline looks healthy.')).toBeTruthy();
  });
});
