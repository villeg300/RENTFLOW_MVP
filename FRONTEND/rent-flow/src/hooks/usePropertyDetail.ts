"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchProperty } from "@/services/properties.service"
import type { Property } from "@/types/property.types"

interface PropertyDetailState {
  data: Property | null
  isLoading: boolean
  error: NormalizedError | null
}

export function usePropertyDetail(agencyId: string | null, propertyId?: string) {
  const [state, setState] = useState<PropertyDetailState>({
    data: null,
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId || !propertyId) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchProperty(agencyId, propertyId)
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, propertyId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
