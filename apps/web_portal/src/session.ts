/**
 * Web session storage policy (Phase 2):
 * - access token: in-memory only
 * - refresh token: sessionStorage (cleared when the tab closes; not localStorage)
 * Production browsers should migrate to HttpOnly cookies + CSRF (see docs/security).
 */

const REFRESH_KEY = "ridenova.refresh";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(REFRESH_KEY, token);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    /* private mode */
  }
}

export function clearSession(): void {
  accessToken = null;
  setRefreshToken(null);
}
