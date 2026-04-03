"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchRooms, createRoom } from "@/services/properties.service"
import type { CreateRoomPayload, Room } from "@/types/property.types"

interface RoomsState {
  data: Room[]
  isLoading: boolean
  error: NormalizedError | null
}

export function useRooms(agencyId: string | null, propertyId?: string) {
  const [state, setState] = useState<RoomsState>({
    data: [],
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId || !propertyId) {
      setState({ data: [], isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchRooms(agencyId, propertyId)
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, propertyId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (payload: CreateRoomPayload) => {
      if (!agencyId) {
        throw new Error("Agence active manquante.")
      }
      const room = await createRoom(agencyId, payload)
      setState((prev) => ({ ...prev, data: [room, ...prev.data] }))
      return room
    },
    [agencyId]
  )

  return { ...state, refresh: load, create }
}
