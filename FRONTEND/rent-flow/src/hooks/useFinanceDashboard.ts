"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchFinanceDashboard } from "@/services/finance.service";
import type { FinanceDashboard } from "@/types/finance.types";
import type { NormalizedError } from "@/lib/axios";

interface FinanceDashboardState {
  data: FinanceDashboard | null;
  isLoading: boolean;
  error: NormalizedError | null;
}

interface UseFinanceDashboardParams {
  agencyId: string | null;
  startDate?: string;
  endDate?: string;
}

export function useFinanceDashboard({
  agencyId,
  startDate,
  endDate,
}: UseFinanceDashboardParams) {
  const [state, setState] = useState<FinanceDashboardState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!agencyId) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await fetchFinanceDashboard({
        agencyId,
        startDate,
        endDate,
      });
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as NormalizedError });
    }
  }, [agencyId, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refresh: load,
  };
}
