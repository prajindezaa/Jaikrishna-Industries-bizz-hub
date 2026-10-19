/**
 * Jaikrishna Industries — Central Canonical Domain & Origin Configuration
 * Single source of truth for frontend, server API, and notification deep links.
 */

export const CANONICAL_APEX = 'https://jaikrishnabizzhub.in';
export const CANONICAL_WWW = 'https://www.jaikrishnabizzhub.in';
export const OLD_DOMAIN_VERCEL = 'https://jaikrishna-industries-bizz-hub.vercel.app';

export const ALLOWED_PRODUCTION_ORIGINS = [
  CANONICAL_APEX,
  CANONICAL_WWW,
  OLD_DOMAIN_VERCEL, // Allowed during 90-day transition window
];

export const ALLOWED_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Returns validated canonical app URL without trailing slash.
 */
export function getAppUrl(): string {
  const envUrl =
    (typeof process !== 'undefined' && process.env?.APP_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_APP_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_URL) ||
    '';

  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if (trimmed) {
    return trimmed;
  }

  // Fallback depending on environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return CANONICAL_APEX;
}

/**
 * Checks if a given request origin is authorized.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');

  const isDev =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV));

  if (ALLOWED_PRODUCTION_ORIGINS.includes(cleanOrigin)) {
    return true;
  }

  if (isDev && ALLOWED_DEV_ORIGINS.includes(cleanOrigin)) {
    return true;
  }

  return false;
}

/**
 * Builds an absolute canonical deep link on the active APP_URL origin.
 */
export function buildCanonicalDeepLink(pathAndQuery: string): string {
  const base = getAppUrl();
  const cleanPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${base}${cleanPath}`;
}
