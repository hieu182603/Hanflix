/**
 * Vitest setup — minimal, no external test runner config.
 * We avoid pulling in jest-dom to keep the dep count low; tests can use
 * raw `document` APIs instead.
 */
import { vi } from 'vitest';

// Polyfill `crypto.randomUUID` if missing in the test jsdom runtime.
if (!('randomUUID' in globalThis.crypto)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.crypto as any).randomUUID = () => Math.random().toString(36).slice(2);
}

// Default mock for `performance.now` so tests get a stable baseline.
const performanceOrigin = Date.now();
const mockPerf = {
  now: vi.fn(() => Date.now() - performanceOrigin),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  getEntries: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = mockPerf;
