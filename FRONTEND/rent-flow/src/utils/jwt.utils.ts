import type { JwtPayload } from "@/types/auth.types";

/**
 * Décode la partie payload d'un JWT sans vérification de signature
 * (la vérification se fait côté serveur).
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Padding base64url → base64
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Retourne true si le token expire dans moins de `bufferSeconds` secondes
 * (ou s'il est déjà expiré).
 */
export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < bufferSeconds;
}

/** Retourne le nombre de secondes avant expiration (négatif si expiré). */
export function getTokenTtl(token: string): number {
  const payload = decodeJwt(token);
  if (!payload) return -1;
  return payload.exp - Math.floor(Date.now() / 1000);
}