import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  setAccessToken,
} from "@/utils/token-storage.utils";
import { isTokenExpired } from "@/utils/jwt.utils";
import type { TokenPair } from "@/types/auth.types";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "v1";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// ─── Gestion du refresh concurrent ───────────────────────────────────────────

/**
 * File d'attente des requêtes bloquées pendant le refresh.
 * Toutes sont relancées (resolve) ou rejetées (reject) une fois le refresh terminé.
 */
type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let refreshQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null): void {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
}

// ─── Callback de déconnexion forcée ──────────────────────────────────────────

/**
 * Appelé lorsque le refresh échoue (token expiré / révoqué).
 * Remplacé par AuthContext via `setUnauthorizedHandler`.
 */
let onUnauthorized: () => void = () => {
  clearTokens();
  if (typeof window !== "undefined") {
    window.location.href = "/auth/login";
  }
};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

// ─── Instance Axios ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ── Intercepteur de requête : injecte le Bearer token ──────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Certaines routes publiques n'ont pas besoin du token
    if (config.headers?.["X-No-Auth"]) {
      delete config.headers["X-No-Auth"];
      return config;
    }

    let accessToken = getAccessToken();

    // Si le token expire bientôt, on le rafraîchit de façon proactive
    if (accessToken && isTokenExpired(accessToken)) {
      accessToken = await refreshAccessToken();
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Intercepteur de réponse : retry après 401 ─────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    const is401 = error.response?.status === 401;
    const alreadyRetried = originalRequest._retry;

    if (!is401 || alreadyRetried) {
      return Promise.reject(normalizeError(error));
    }

    // Évite les boucles infinies sur les endpoints d'auth eux-mêmes
    const url = originalRequest.url ?? "";
    const isAuthEndpoint =
      url.includes("jwt/create") ||
      url.includes("jwt/refresh") ||
      url.includes("jwt/logout");

    if (isAuthEndpoint) {
      onUnauthorized();
      return Promise.reject(normalizeError(error));
    }

    if (isRefreshing) {
      // Une requête de refresh est déjà en cours → on met celle-ci en file
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };
          originalRequest._retry = true;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newAccessToken = await refreshAccessToken();
      processQueue(null, newAccessToken);
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      onUnauthorized();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Refresh token ────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    onUnauthorized();
    throw new Error("Aucun refresh token disponible.");
  }

  const response = await axios.post<TokenPair>(
    `${BASE_URL}/auth/jwt/refresh/`,
    { refresh },
    { headers: { "Content-Type": "application/json" } }
  );

  // simplejwt avec ROTATE_REFRESH_TOKENS retourne aussi un nouveau refresh
  saveTokens(response.data);
  setAccessToken(response.data.access);
  return response.data.access;
}

// ─── Normalisation des erreurs ────────────────────────────────────────────────

export interface NormalizedError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
  raw?: unknown;
}

export function normalizeError(error: unknown): NormalizedError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;

    // Djoser renvoie les erreurs sous plusieurs formes
    let message = "Une erreur est survenue.";
    let fieldErrors: Record<string, string[]> | undefined;

    if (typeof data === "object" && data !== null) {
      if ("detail" in data) {
        message = String(data.detail);
      } else if ("non_field_errors" in data) {
        message = (data.non_field_errors as string[]).join(" ");
      } else {
        // Erreurs de champs
        fieldErrors = data as Record<string, string[]>;
        const firstField = Object.values(fieldErrors)[0];
        if (Array.isArray(firstField) && firstField.length > 0) {
          message = firstField[0];
        }
      }
    } else if (typeof data === "string") {
      message = data;
    }

    return { status, message, fieldErrors, raw: error };
  }

  return { status: 0, message: "Erreur réseau ou inattendue.", raw: error };
}