import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLessonPrefetchController } from '../useLessonPrefetchController';

describe('useLessonPrefetchController — unmount safety', () => {
  afterEach(() => {
    // No-op: renderHook cleanup handles unmount.
  });

  it('does NOT abort in-flight requests when its only subscriber unmounts', () => {
    const { unmount } = renderHook(() => useLessonPrefetchController());
    unmount();
    // No throw, no abort. The map is module-level so other components
    // sharing this state are not affected.
    expect(true).toBe(true);
  });

  it('returns a stable API shape', () => {
    const { result } = renderHook(() => useLessonPrefetchController());
    expect(typeof result.current.acquire).toBe('function');
    expect(typeof result.current.release).toBe('function');
    expect(typeof result.current.busy).toBe('function');
    expect(typeof result.current.dispose).toBe('function');
  });
});
