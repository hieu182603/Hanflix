/**
 * Google Analytics (GA4) Utility
 * Safe initialization with empty key support.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let isInitialized = false;

/**
 * Initializes Google Analytics GA4 using VITE_GA_MEASUREMENT_ID
 */
export function initGA(): void {
  if (isInitialized) return;

  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  // If key is empty or not provided, gracefully do nothing
  if (!gaId) {
    if (import.meta.env.DEV) {
      console.info('[Analytics] VITE_GA_MEASUREMENT_ID is empty. Google Analytics is inactive.');
    }
    return;
  }

  try {
    // Inject Google Tag Manager script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function (...args: unknown[]) {
      window.dataLayer?.push(args);
    };

    window.gtag('js', new Date());
    window.gtag('config', gaId, {
      send_page_view: true,
    });

    isInitialized = true;
    console.info(`[Analytics] Google Analytics initialized with ID: ${gaId}`);
  } catch (error) {
    console.error('[Analytics] Failed to initialize Google Analytics:', error);
  }
}

/**
 * Tracks a page view event
 */
export function trackPageView(path: string, title?: string): void {
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!gaId || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}

/**
 * Tracks a custom event in GA4
 */
export function trackEvent(
  action: string,
  params?: {
    category?: string;
    label?: string;
    value?: number;
    [key: string]: unknown;
  }
): void {
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!gaId || !window.gtag) return;

  window.gtag('event', action, params);
}
