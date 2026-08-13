"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import {
  createBuilding,
  deleteBuilding,
  fetchBuildings,
  updateBuilding,
} from "@/services/properties.service"
import type {
  Building,
  CreateBuildingPayload,
  UpdateBuildingPayload,
} from "@/types/property.types"

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
    const timeoutId = setTimeout(() => {
      void load()
    }, 0)

    return () => clearTimeout(timeoutId)
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

  const update = useCallback(
    async (buildingId: string, payload: UpdateBuildingPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const building = await updateBuilding(agencyId, buildingId, payload)
      setState((prev) => ({
        ...prev,
        data: prev.data.map((item) => (item.id === building.id ? building : item)),
      }))
      return building
    },
    [agencyId]
  )

  const remove = useCallback(
    async (buildingId: string) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      await deleteBuilding(agencyId, buildingId)
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== buildingId),
      }))
    },
    [agencyId]
  )

  return { ...state, refresh: load, create, update, remove }
}
