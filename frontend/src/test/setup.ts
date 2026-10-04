import "@testing-library/jest-dom/vitest";

// jsdom lacks ResizeObserver, which Recharts needs.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

// Node 25 exposes an experimental global localStorage without the Storage API; use a simple in-memory one.
const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() { return store.size; },
  clear: () => store.clear(),
  getItem: (k) => store.get(k) ?? null,
  key: (i) => Array.from(store.keys())[i] ?? null,
  removeItem: (k) => void store.delete(k),
  setItem: (k, v) => void store.set(k, String(v)),
};
Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
const sessionStore = new Map<string, string>();
const memorySession: Storage = { ...memoryStorage,
  get length() { return sessionStore.size; },
  clear: () => sessionStore.clear(),
  getItem: (k) => sessionStore.get(k) ?? null,
  key: (i) => Array.from(sessionStore.keys())[i] ?? null,
  removeItem: (k) => void sessionStore.delete(k),
  setItem: (k, v) => void sessionStore.set(k, String(v)) };
Object.defineProperty(globalThis, "sessionStorage", { value: memorySession, configurable: true });
Object.defineProperty(window, "sessionStorage", { value: memorySession, configurable: true });

// jsdom has no matchMedia.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: /prefers-reduced-motion/.test(query), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
