"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { createBuilding, fetchBuildings } from "@/services/properties.service"
import type { Building, CreateBuildingPayload } from "@/types/property.types"

interface BuildingsState {
  data: Building[]
  isLoading: boolean
  error: NormalizedError | null
}

export function useBuildings(agencyId: string | null) {
  const [state, setState] = useState<BuildingsState>({
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
      const data = await fetchBuildings(agencyId)
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (payload: CreateBuildingPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const building = await createBuilding(agencyId, payload)
      setState((prev) => ({ ...prev, data: [building, ...prev.data] }))
      return building
    },
    [agencyId]
  )

  return { ...state, refresh: load, create }
}
