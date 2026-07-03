// Registers @testing-library/jest-dom's DOM matchers (toBeInTheDocument,
// toHaveTextContent, …) on Vitest's expect. Loaded via vite.config test.setupFiles.
import '@testing-library/jest-dom/vitest';

// Unmount rendered components after each test. Testing Library's auto-cleanup
// only self-registers when Vitest `globals` are on; we don't use globals, so
// wire it up explicitly — otherwise renders accumulate and queries find dupes.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom (this jsdom+Vitest combo) doesn't expose Storage; components that read
// localStorage on mount (ThemeContext, AuthContext) would throw. Provide a minimal
// in-memory shim. Guarded so it's a no-op if the environment ever supplies one.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// jsdom doesn't implement matchMedia; ThemeContext uses it for prefers-color-scheme.
// Standard no-op mock (reports "not dark").
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
