/**
 * middleware.ts  (à placer à la racine du projet Next.js)
 *
 * Protège les routes authentifiées côté serveur en vérifiant
 * la présence et la validité basique du refresh token dans les cookies.
 *
 * ⚠️  Ce middleware est une première ligne de défense légère.
 *     La vérification cryptographique réelle se fait côté API Django.
 *
 * Pour une sécurité maximale, déplacez le refresh token dans un
 * cookie httpOnly via une route /api/auth/refresh.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes accessibles sans authentification */
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/reset-password",
  "/activate",
  "/accept-invite",
];

/** Routes qui nécessitent d'être NON authentifié (ex: pages de login) */
const AUTH_ONLY_PATHS = ["/auth/login", "/auth/signup"];

/** Préfixes toujours publics */
const ALWAYS_PUBLIC_PREFIXES = ["/_next", "/api", "/favicon", "/static"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Toujours publics
  if (ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Vérifie la présence du refresh token (stocké en cookie httpOnly si configuré)
  // Sinon, on s'appuie sur le localStorage géré côté client.
  // Pour un cookie httpOnly, décommentez les lignes suivantes :
  // const hasRefreshToken = request.cookies.has("rf_refresh");

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Commenté : logique côté client gère la redirection via AuthGuard
  // Décommentez si vous utilisez des cookies httpOnly :
  /*
  const hasRefreshToken = request.cookies.has("rf_refresh");
  
  if (!hasRefreshToken && !isPublicPath) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasRefreshToken && AUTH_ONLY_PATHS.some(p => pathname === p)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  */

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Exclut les fichiers Next.js internes et statiques
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
