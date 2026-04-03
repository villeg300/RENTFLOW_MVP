"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchLeases, type FetchLeasesParams } from "@/services/leases.service"
import type { Lease } from "@/types/lease.types"

interface LeasesState {
  data: Lease[]
  isLoading: boolean
  error: NormalizedError | null
}

interface UseLeasesParams extends Omit<FetchLeasesParams, "agencyId"> {
  agencyId: string | null
}

export function useLeases({ agencyId, propertyId, status }: UseLeasesParams) {
  const [state, setState] = useState<LeasesState>({
    data: [],
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId) {
      setState({ data: [], isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchLeases({ agencyId, propertyId, status })
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, propertyId, status])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
