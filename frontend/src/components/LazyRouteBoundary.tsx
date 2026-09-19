import { Suspense, type ReactNode } from 'react';
import HanFlixLoadingScreen from './HanFlixLoadingScreen';

/**
 * Suspense boundary for React.lazy() page components.
 *
 * Why a wrapper instead of inlining `<Suspense>` everywhere?
 *   - Centralises the fallback so all lazy routes share the same loading
 *     surface (matches `App.tsx`'s session-restoring loader at the very top).
 *   - Lets future tweaks (route transition animations, skeleton shells,
 *     per-route spinners) live in a single file.
 *
 * The fallback must be a component that does NOT itself trigger lazy imports.
 * `HanFlixLoadingScreen` is already in the initial bundle (referenced during
 * session restore), so it never causes a circular dependency.
 */
export function LazyRouteBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<HanFlixLoadingScreen />}>{children}</Suspense>;
}
