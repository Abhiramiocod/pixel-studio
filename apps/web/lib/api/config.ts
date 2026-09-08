/**
 * API configuration.
 *
 * Deliberately tiny: it resolves the API base URL and nothing else. Request
 * helpers, authentication and data fetching arrive with the endpoints that
 * need them.
 */

const DEFAULT_API_URL = "http://localhost:3001";

/** Base URL of the Pixel Studio API, without a trailing slash. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL
).replace(/\/+$/, "");

/** Absolute URL for an API path, e.g. `apiUrl("/health")`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
