// ─── Token Types ────────────────────────────────────────────────────────────

/**
 * Payload décodé du JWT access token.
 * Les champs agency_* sont injectés par PhoneOrEmailTokenObtainPairSerializer
 * uniquement si l'utilisateur est membre d'une agence.
 */
export interface JwtPayload {
  token_type: "access" | "refresh";
  exp: number;        // Unix timestamp
  iat: number;        // Unix timestamp
  jti: string;        // JWT ID unique
  user_id: string;    // UUID
  agency_id?: string; // UUID — présent si membre d'une agence
  agency_role?: string;
  agency_slug?: string;
}

/** Paire de tokens retournée par /auth/jwt/create/ */
export interface TokenPair {
  access: string;
  refresh: string;
}

/** Paire de tokens stockée en session (refresh en httpOnly cookie idéalement) */
export interface StoredTokens extends TokenPair {}

// ─── User Types ─────────────────────────────────────────────────────────────

export interface AgencyMembership {
  agency_id: string;
  name: string;
  slug: string;
  role: string;
}

export interface User {
  id: string;
  phone_number: string;
  email: string;
  full_name: string;
  agencies: AgencyMembership[];
}

// ─── Request / Response Types ────────────────────────────────────────────────

/** Body envoyé à POST /auth/jwt/create/ */
export interface LoginCredentials {
  /** Email ou numéro de téléphone */
  login?: string;
  email?: string;
  phone_number?: string;
  password: string;
  /** UUID de l'agence si l'utilisateur en a plusieurs */
  agency_id?: string;
}

/** Body envoyé à POST /auth/users/ (inscription) */
export interface RegisterPayload {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  re_password: string;
}

/** Body envoyé à POST /auth/users/reset_password/ */
export interface ResetPasswordPayload {
  email: string;
}

/** Body envoyé à POST /auth/users/reset_password_confirm/ */
export interface ResetPasswordConfirmPayload {
  uid: string;
  token: string;
  new_password: string;
  re_new_password: string;
}

/** Body envoyé à POST /auth/users/activation/ */
export interface ActivationPayload {
  uid: string;
  token: string;
}

// ─── Auth State ──────────────────────────────────────────────────────────────

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiFieldErrors {
  [field: string]: string[];
}

export interface ApiError {
  status: number;
  message: string;
  fieldErrors?: ApiFieldErrors;
}