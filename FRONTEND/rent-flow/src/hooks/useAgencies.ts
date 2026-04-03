"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { createAgency, fetchAgencies } from "@/services/agencies.service"
import type { Agency, CreateAgencyPayload } from "@/types/agency.types"

interface AgenciesState {
  data: Agency[]
  isLoading: boolean
  error: NormalizedError | null
}

export function useAgencies() {
  const [state, setState] = useState<AgenciesState>({
    data: [],
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchAgencies()
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(async (payload: CreateAgencyPayload) => {
    const agency = await createAgency(payload)
    setState((prev) => ({ ...prev, data: [agency, ...prev.data] }))
    return agency
  }, [])

  return {
    ...state,
    refresh: load,
    create,
  }
}
