"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
  redirectIfAuthenticated?: string;
  fallback?: ReactNode;
}

/**
 * AuthGuard — version corrigée
 *
 * Problème de la version précédente :
 * La logique de rendu avait un cas non couvert :
 *   isLoading=false + isAuthenticated=false + redirectIfAuthenticated=undefined
 *   → retournait `fallback` ET déclenchait la redirection dans useEffect,
 *     mais entre les deux ticks React, `children` pouvait être rendu.
 *
 * Fix : le rendu est entièrement piloté par l'état, pas par les effets.
 * La redirection reste dans useEffect (seul endroit autorisé pour router.replace),
 * mais le rendu des children est bloqué jusqu'à ce que l'état soit stable.
 */
export function AuthGuard({
  children,
  redirectTo = "/auth/login",
  redirectIfAuthenticated,
  fallback = null,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !redirectIfAuthenticated) {
      const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    }

    if (isAuthenticated && redirectIfAuthenticated) {
      router.replace(redirectIfAuthenticated);
    }
  }, [isAuthenticated, isLoading, redirectTo, redirectIfAuthenticated, router, pathname]);

  // ── Hydratation : on évite le mismatch SSR/CSR ───────────────────────────
  if (!mounted) {
    return <>{fallback}</>;
  }

  // ── Pendant le chargement → toujours le fallback ─────────────────────────
  if (isLoading) {
    return <>{fallback}</>;
  }

  // ── Route protégée (pas de redirectIfAuthenticated) ───────────────────────
  if (!redirectIfAuthenticated) {
    // Non authentifié → fallback (la redirection se fait en parallèle dans useEffect)
    if (!isAuthenticated) return <>{fallback}</>;
    // Authentifié → on affiche le contenu
    return <>{children}</>;
  }

  // ── Route "auth only" (ex: login, signup) ────────────────────────────────
  // Authentifié → fallback (on est en train de rediriger)
  if (isAuthenticated) return <>{fallback}</>;
  // Non authentifié → on affiche le formulaire
  return <>{children}</>;
}
