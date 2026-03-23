/**
 * auth.service.ts
 *
 * Toutes les opérations d'authentification vers l'API Django/Djoser.
 * Les fonctions sont pures (pas d'état React) et utilisables hors composants.
 */

import axios from "axios";
import { apiClient, BASE_URL, normalizeError } from "@/lib/axios";
import { clearTokens, saveTokens } from "@/utils/token-storage.utils";
import type {
  ActivationPayload,
  LoginCredentials,
  RegisterPayload,
  ResetPasswordConfirmPayload,
  ResetPasswordPayload,
  TokenPair,
  User,
} from "@/types/auth.types";

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authentifie l'utilisateur et stocke les tokens.
 * Accepte email, téléphone ou le champ générique `login`.
 */
export async function login(credentials: LoginCredentials): Promise<TokenPair> {
  try {
    const { data } = await axios.post<TokenPair>(
      `${BASE_URL}/auth/jwt/create/`,
      credentials,
      { headers: { "Content-Type": "application/json" } }
    );
    saveTokens(data);
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Révoque le refresh token courant côté serveur, puis purge le stockage local.
 */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await apiClient.post("/auth/jwt/logout/", { refresh: refreshToken });
  } catch {
    // On nettoie quoi qu'il arrive
  } finally {
    clearTokens();
  }
}

/**
 * Révoque TOUS les refresh tokens de l'utilisateur (déconnexion globale).
 * Nécessite un access token valide (requête authentifiée).
 */
export async function logoutAll(): Promise<void> {
  try {
    await apiClient.post("/auth/jwt/logout_all/");
  } catch {
    // On nettoie quoi qu'il arrive
  } finally {
    clearTokens();
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Crée un nouveau compte utilisateur.
 * Djoser envoie ensuite un email d'activation si SEND_ACTIVATION_EMAIL=True.
 */
export async function register(payload: RegisterPayload): Promise<User> {
  try {
    const { data } = await axios.post<User>(
      `${BASE_URL}/auth/users/`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ─── Current user ─────────────────────────────────────────────────────────────

/** Récupère le profil de l'utilisateur connecté. */
export async function fetchCurrentUser(): Promise<User> {
  try {
    const { data } = await apiClient.get<User>("/auth/users/me/");
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ─── Account activation ───────────────────────────────────────────────────────

/**
 * Active le compte depuis le lien reçu par email.
 * uid et token proviennent des query params de l'URL d'activation.
 */
export async function activateAccount(payload: ActivationPayload): Promise<void> {
  try {
    await axios.post(
      `${BASE_URL}/auth/users/activation/`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw normalizeError(error);
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

/** Demande un email de réinitialisation de mot de passe. */
export async function requestPasswordReset(
  payload: ResetPasswordPayload
): Promise<void> {
  try {
    await axios.post(
      `${BASE_URL}/auth/users/reset_password/`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw normalizeError(error);
  }
}

/** Confirme la réinitialisation avec uid + token + nouveau mot de passe. */
export async function confirmPasswordReset(
  payload: ResetPasswordConfirmPayload
): Promise<void> {
  try {
    await axios.post(
      `${BASE_URL}/auth/users/reset_password_confirm/`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw normalizeError(error);
  }
}

// ─── Change password (authentifié) ───────────────────────────────────────────

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
  re_new_password: string;
}): Promise<void> {
  try {
    await apiClient.post("/auth/users/set_password/", payload);
  } catch (error) {
    throw normalizeError(error);
  }
}