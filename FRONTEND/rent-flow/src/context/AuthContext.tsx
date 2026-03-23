"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchCurrentUser,
  login as loginService,
  logout as logoutService,
  logoutAll as logoutAllService,
  register as registerService,
} from "@/services/auth.service";
import {
  clearTokens,
  getRefreshToken,
  getStoredTokens,
} from "@/utils/token-storage.utils";
import { setUnauthorizedHandler } from "@/lib/axios";
import type {
  AuthState,
  LoginCredentials,
  RegisterPayload,
  User,
} from "@/types/auth.types";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  /** True tant que l'état auth n'est pas définitivement connu */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
  loginPath?: string;
}

/**
 * Calcule le status initial DE FAÇON SYNCHRONE avant le premier rendu.
 *
 * Si aucun token n'est présent en localStorage, on sait immédiatement
 * que l'utilisateur n'est pas authentifié → pas de flash ni de redirection
 * asynchrone.
 *
 * Si des tokens sont présents, on reste en "loading" le temps de vérifier
 * avec l'API que le token est encore valide.
 */
function getInitialStatus(): AuthState {
  // localStorage n'est pas disponible côté serveur (SSR)
  if (typeof window === "undefined") {
    return { user: null, status: "loading", error: null };
  }
  const tokens = getStoredTokens();
  if (!tokens) {
    // Pas de tokens → on sait déjà que l'utilisateur n'est pas connecté
    return { user: null, status: "unauthenticated", error: null };
  }
  // Tokens présents → on va vérifier avec l'API
  return { user: null, status: "loading", error: null };
}

export function AuthProvider({ children, loginPath = "/auth/login" }: AuthProviderProps) {
  const router = useRouter();

  // Initialisation synchrone : évite le flash "loading → unauthenticated"
  // qui laissait passer le AuthGuard pendant un tick
  const [state, setState] = useState<AuthState>(getInitialStatus);

  const initialized = useRef(false);

  // ── Déconnexion forcée (appelée par l'intercepteur axios sur 401) ─────────

  const forceLogout = useCallback(() => {
    clearTokens();
    setState({ user: null, status: "unauthenticated", error: null });
    router.push(loginPath);
  }, [loginPath, router]);

  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
  }, [forceLogout]);

  // ── Initialisation : vérifie la session existante ─────────────────────────

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Si on a déjà déterminé synchronement qu'il n'y a pas de tokens, rien à faire
    const tokens = getStoredTokens();
    if (!tokens) return;

    // Des tokens existent → valider avec l'API
    fetchCurrentUser()
      .then((user) => {
        setState({ user, status: "authenticated", error: null });
      })
      .catch(() => {
        clearTokens();
        setState({ user: null, status: "unauthenticated", error: null });
      });
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await loginService(credentials);
      const user = await fetchCurrentUser();
      setState({ user, status: "authenticated", error: null });
    } catch (error: unknown) {
      const err = error as { message?: string };
      setState((s) => ({
        ...s,
        status: "unauthenticated",
        error: err.message ?? "Connexion échouée.",
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    setState((s) => ({ ...s, status: "loading" }));
    if (refresh) await logoutService(refresh);
    else clearTokens();
    setState({ user: null, status: "unauthenticated", error: null });
    router.push(loginPath);
  }, [loginPath, router]);

  const logoutAll = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    await logoutAllService();
    setState({ user: null, status: "unauthenticated", error: null });
    router.push(loginPath);
  }, [loginPath, router]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await registerService(payload);
      setState((s) => ({ ...s, status: "unauthenticated" }));
    } catch (error: unknown) {
      const err = error as { message?: string };
      setState((s) => ({
        ...s,
        status: "unauthenticated",
        error: err.message ?? "Inscription échouée.",
      }));
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setState((s) => ({ ...s, user }));
    } catch {
      // Silencieux : l'intercepteur gère les 401
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    logoutAll,
    register,
    refreshUser,
    isAuthenticated: state.status === "authenticated",
    // "idle" supprimé — on n'a plus cet état intermédiaire ambigu
    isLoading: state.status === "loading",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext doit être utilisé dans un <AuthProvider>.");
  }
  return context;
}