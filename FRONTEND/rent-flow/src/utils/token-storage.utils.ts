import type { StoredTokens } from "@/types/auth.types";

/**
 * Stratégie de stockage des tokens.
 *
 * - access token  : mémoire uniquement (variable module) pour éviter
 *                   les attaques XSS sur localStorage.
 * - refresh token : localStorage (persistance entre onglets/rechargements).
 *                   En production, préférer un cookie httpOnly géré par
 *                   une route Next.js /api/auth/refresh.
 */

const ACCESS_TOKEN_KEY = "rf_access";   // préfixe rf = RentFlow
const REFRESH_TOKEN_KEY = "rf_refresh";

// ─── In-memory access token ──────────────────────────────────────────────────

let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  // Hydratation depuis localStorage au premier accès (ex: rechargement page)
  if (_accessToken === null) {
    _accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return _accessToken;
}

export function setAccessToken(token: string): void {
  _accessToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function clearAccessToken(): void {
  _accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

// ─── Refresh token ───────────────────────────────────────────────────────────

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export function clearRefreshToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

// ─── Helpers groupés ─────────────────────────────────────────────────────────

export function saveTokens(tokens: StoredTokens): void {
  setAccessToken(tokens.access);
  setRefreshToken(tokens.refresh);
}

export function clearTokens(): void {
  clearAccessToken();
  clearRefreshToken();
}

export function getStoredTokens(): StoredTokens | null {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (!access || !refresh) return null;
  return { access, refresh };
}