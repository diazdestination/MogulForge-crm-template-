/**
 * Global test-environment setup for the command-center vitest suite.
 *
 * jsdom does not implement several browser APIs that the app uses. Stub them
 * here so tests don't throw "Not implemented" errors for browser behaviour
 * that isn't relevant to the logic under test.
 */
import { beforeEach } from 'vitest';

// jsdom throws "Not implemented: window.scrollTo". The shell calls this on
// every route change; stub it so tests that render <Shell> don't fail.
window.scrollTo = () => {};

// jsdom does not implement Element.prototype.scrollIntoView; the chat page
// calls it to auto-scroll to the latest message. Stub it silently.
Element.prototype.scrollIntoView = () => {};

// Reset window.location before every test so that components using the URL
// as state (e.g. Pipeline filter sync) don't carry URL changes from one test
// into the next.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
