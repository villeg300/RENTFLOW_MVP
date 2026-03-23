// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  JwtPayload,
  TokenPair,
  StoredTokens,
  AgencyMembership,
  User,
  LoginCredentials,
  RegisterPayload,
  ResetPasswordPayload,
  ResetPasswordConfirmPayload,
  ActivationPayload,
  AuthState,
  AuthStatus,
  ApiError,
  ApiFieldErrors,
} from "@/types/auth.types";

// ─── Utils ────────────────────────────────────────────────────────────────────
export { decodeJwt, isTokenExpired, getTokenTtl } from "@/utils/jwt.utils";
export {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  getStoredTokens,
} from "@/utils/token-storage.utils";

// ─── Axios client ─────────────────────────────────────────────────────────────
export { apiClient, normalizeError, BASE_URL } from "@/lib/axios";
export type { NormalizedError } from "@/lib/axios";

// ─── Service ──────────────────────────────────────────────────────────────────
export {
  login,
  logout,
  logoutAll,
  register,
  fetchCurrentUser,
  activateAccount,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
} from "@/services/auth.service";

// ─── Context ──────────────────────────────────────────────────────────────────
export { AuthProvider, useAuthContext } from "@/context/AuthContext";

// ─── Hooks ────────────────────────────────────────────────────────────────────
export {
  useLogin,
  useRegister,
  useLogout,
  useCurrentUser,
  useActivation,
  useRequestPasswordReset,
  useConfirmPasswordReset,
  useChangePassword,
} from "@/hooks/useAuth";

// ─── Components ───────────────────────────────────────────────────────────────
export { AuthGuard } from "@/components/AuthGuard";