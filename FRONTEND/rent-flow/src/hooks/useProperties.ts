"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import {
  createProperty,
  fetchProperties,
  type FetchPropertiesParams,
} from "@/services/properties.service"
import type { CreatePropertyPayload, Property } from "@/types/property.types"

interface PropertiesState {
  data: Property[]
  isLoading: boolean
  error: NormalizedError | null
}

interface UsePropertiesParams extends Omit<FetchPropertiesParams, "agencyId"> {
  agencyId: string | null
}

export function useProperties({
  agencyId,
  propertyType,
  isAvailable,
  buildingId,
}: UsePropertiesParams) {
  const [state, setState] = useState<PropertiesState>({
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
      const data = await fetchProperties({
        agencyId,
        propertyType,
        isAvailable,
        buildingId,
      })
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, propertyType, isAvailable, buildingId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (payload: CreatePropertyPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const property = await createProperty(agencyId, payload)
      setState((prev) => ({ ...prev, data: [property, ...prev.data] }))
      return property
    },
    [agencyId]
  )

  return { ...state, refresh: load, create }
}
