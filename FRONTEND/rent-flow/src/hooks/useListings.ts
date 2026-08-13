"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import {
  createListing,
  deleteListing,
  fetchListings,
  updateListing,
} from "@/services/properties.service"
import type {
  CreateListingPayload,
  Listing,
  UpdateListingPayload,
} from "@/types/property.types"

interface ListingsState {
  data: Listing[]
  isLoading: boolean
  error: NormalizedError | null
}

export function useListings(agencyId: string | null) {
  const [state, setState] = useState<ListingsState>({
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
      const data = await fetchListings(agencyId)
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
    async (payload: CreateListingPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const listing = await createListing(agencyId, payload)
      setState((prev) => ({ ...prev, data: [listing, ...prev.data] }))
      return listing
    },
    [agencyId]
  )

  const update = useCallback(
    async (listingId: string, payload: UpdateListingPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const listing = await updateListing(agencyId, listingId, payload)
      setState((prev) => ({
        ...prev,
        data: prev.data.map((item) => (item.id === listing.id ? listing : item)),
      }))
      return listing
    },
    [agencyId]
  )

  const remove = useCallback(
    async (listingId: string) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      await deleteListing(agencyId, listingId)
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== listingId),
      }))
    },
    [agencyId]
  )

  return { ...state, refresh: load, create, update, remove }
}
