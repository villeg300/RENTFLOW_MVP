"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuthContext } from "@/context/AuthContext";
import type { AgencyMembership } from "@/types/auth.types";

const AGENCY_STORAGE_KEY = "rf_active_agency_id";

interface AgencyContextValue {
  agencies: AgencyMembership[];
  activeAgencyId: string | null;
  activeAgency: AgencyMembership | null;
  setActiveAgencyId: (agencyId: string | null) => void;
  isLoading: boolean;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

function readStoredAgencyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AGENCY_STORAGE_KEY);
}

function storeAgencyId(agencyId: string | null) {
  if (typeof window === "undefined") return;
  if (!agencyId) {
    window.localStorage.removeItem(AGENCY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AGENCY_STORAGE_KEY, agencyId);
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const agencies = user?.agencies ?? [];
  const [activeAgencyId, setActiveAgencyIdState] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!agencies.length) {
      setActiveAgencyIdState(null);
      storeAgencyId(null);
      return;
    }

    setActiveAgencyIdState((current) => {
      if (current && agencies.some((agency) => agency.agency_id === current)) {
        return current;
      }

      const stored = readStoredAgencyId();
      if (stored && agencies.some((agency) => agency.agency_id === stored)) {
        storeAgencyId(stored);
        return stored;
      }

      const fallback = agencies[0].agency_id;
      storeAgencyId(fallback);
      return fallback;
    });
  }, [agencies, isLoading]);

  const setActiveAgencyId = useCallback((agencyId: string | null) => {
    setActiveAgencyIdState(agencyId);
    storeAgencyId(agencyId);
  }, []);

  const activeAgency = useMemo(
    () => agencies.find((agency) => agency.agency_id === activeAgencyId) ?? null,
    [agencies, activeAgencyId]
  );

  const value = useMemo<AgencyContextValue>(
    () => ({
      agencies,
      activeAgency,
      activeAgencyId,
      setActiveAgencyId,
      isLoading,
    }),
    [agencies, activeAgency, activeAgencyId, setActiveAgencyId, isLoading]
  );

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

export function useAgencyContext(): AgencyContextValue {
  const context = useContext(AgencyContext);
  if (!context) {
    throw new Error("useAgencyContext doit être utilisé dans un <AgencyProvider>.");
  }
  return context;
}
