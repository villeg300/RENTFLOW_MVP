"use client";

import { useState, useCallback } from "react";
import { useAuthContext } from "@/context/AuthContext";
import {
  activateAccount,
  confirmPasswordReset,
  requestPasswordReset,
  changePassword,
} from "@/services/auth.service";
import type {
  ActivationPayload,
  LoginCredentials,
  RegisterPayload,
  ResetPasswordConfirmPayload,
  ResetPasswordPayload,
} from "@/types/auth.types";
import { NormalizedError as NE } from "@/lib/axios";

// ─── Types génériques ─────────────────────────────────────────────────────────

interface AsyncState<T = void> {
  data: T | null;
  isLoading: boolean;
  error: NE | null;
}

function useAsyncState<T = void>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const run = useCallback(async (fn: () => Promise<T>) => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const result = await fn();
      setState({ data: result ?? null, isLoading: false, error: null });
      return result;
    } catch (err) {
      setState({ data: null, isLoading: false, error: err as NE });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, run, reset };
}

// ─── useLogin ────────────────────────────────────────────────────────────────

export function useLogin() {
  const { login, isLoading } = useAuthContext();
  const [error, setError] = useState<NE | null>(null);

  const submit = useCallback(
    async (credentials: LoginCredentials) => {
      setError(null);
      try {
        await login(credentials);
      } catch (err) {
        setError(err as NE);
        throw err;
      }
    },
    [login]
  );

  return {
    submit,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

// ─── useRegister ──────────────────────────────────────────────────────────────

interface UseRegisterReturn extends AsyncState {
  submit: (payload: RegisterPayload) => Promise<void>;
  /** True après une inscription réussie (email d'activation envoyé) */
  registered: boolean;
}

export function useRegister(): UseRegisterReturn {
  const { register } = useAuthContext();
  const { isLoading, error, run, reset } = useAsyncState();
  const [registered, setRegistered] = useState(false);

  const submit = useCallback(
    async (payload: RegisterPayload) => {
      await run(async () => {
        await register(payload);
        setRegistered(true);
      });
    },
    [register, run]
  );

  return { submit, isLoading, error, data: null, registered, reset };
}

// ─── useLogout ────────────────────────────────────────────────────────────────

export function useLogout() {
  const { logout, logoutAll, isLoading } = useAuthContext();
  return { logout, logoutAll, isLoading };
}

// ─── useCurrentUser ──────────────────────────────────────────────────────────

export function useCurrentUser() {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuthContext();
  return { user, isAuthenticated, isLoading, refreshUser };
}

// ─── useActivation ───────────────────────────────────────────────────────────

interface UseActivationReturn extends AsyncState {
  activate: (payload: ActivationPayload) => Promise<void>;
  activated: boolean;
}

export function useActivation(): UseActivationReturn {
  const { isLoading, error, data, run } = useAsyncState();
  const [activated, setActivated] = useState(false);

  const activate = useCallback(
    async (payload: ActivationPayload) => {
      await run(async () => {
        await activateAccount(payload);
        setActivated(true);
      });
    },
    [run]
  );

  return { activate, isLoading, error, data, activated };
}

// ─── useRequestPasswordReset ─────────────────────────────────────────────────

interface UseRequestPasswordResetReturn extends AsyncState {
  submit: (payload: ResetPasswordPayload) => Promise<void>;
  emailSent: boolean;
}

export function useRequestPasswordReset(): UseRequestPasswordResetReturn {
  const { isLoading, error, data, run } = useAsyncState();
  const [emailSent, setEmailSent] = useState(false);

  const submit = useCallback(
    async (payload: ResetPasswordPayload) => {
      await run(async () => {
        await requestPasswordReset(payload);
        setEmailSent(true);
      });
    },
    [run]
  );

  return { submit, isLoading, error, data, emailSent };
}

// ─── useConfirmPasswordReset ──────────────────────────────────────────────────

interface UseConfirmPasswordResetReturn extends AsyncState {
  submit: (payload: ResetPasswordConfirmPayload) => Promise<void>;
  confirmed: boolean;
}

export function useConfirmPasswordReset(): UseConfirmPasswordResetReturn {
  const { isLoading, error, data, run } = useAsyncState();
  const [confirmed, setConfirmed] = useState(false);

  const submit = useCallback(
    async (payload: ResetPasswordConfirmPayload) => {
      await run(async () => {
        await confirmPasswordReset(payload);
        setConfirmed(true);
      });
    },
    [run]
  );

  return { submit, isLoading, error, data, confirmed };
}

// ─── useChangePassword ────────────────────────────────────────────────────────

interface UseChangePasswordReturn extends AsyncState {
  submit: (payload: {
    current_password: string;
    new_password: string;
    re_new_password: string;
  }) => Promise<void>;
  changed: boolean;
}

export function useChangePassword(): UseChangePasswordReturn {
  const { isLoading, error, data, run } = useAsyncState();
  const [changed, setChanged] = useState(false);

  const submit = useCallback(
    async (payload: {
      current_password: string;
      new_password: string;
      re_new_password: string;
    }) => {
      await run(async () => {
        await changePassword(payload);
        setChanged(true);
      });
    },
    [run]
  );

  return { submit, isLoading, error, data, changed };
}