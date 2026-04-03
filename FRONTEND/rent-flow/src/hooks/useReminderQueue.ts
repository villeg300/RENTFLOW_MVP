"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchReminderQueue } from "@/services/notifications.service"
import type { ReminderQueueItem } from "@/types/notifications.types"

interface ReminderQueueState {
  data: ReminderQueueItem[]
  isLoading: boolean
  error: NormalizedError | null
}

export function useReminderQueue(agencyId: string | null) {
  const [state, setState] = useState<ReminderQueueState>({
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
      const data = await fetchReminderQueue(agencyId)
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
