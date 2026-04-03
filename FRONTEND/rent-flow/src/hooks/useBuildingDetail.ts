"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchBuilding } from "@/services/properties.service"
import type { Building } from "@/types/property.types"

interface BuildingDetailState {
  data: Building | null
  isLoading: boolean
  error: NormalizedError | null
}

export function useBuildingDetail(agencyId: string | null, buildingId?: string) {
  const [state, setState] = useState<BuildingDetailState>({
    data: null,
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId || !buildingId) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchBuilding(agencyId, buildingId)
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, buildingId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
