"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import { fetchReminderQueue } from "@/services/notifications.service"
import type { ReminderQueueItem, ReminderQueueMeta } from "@/types/notifications.types"

interface ReminderQueueState {
  data: ReminderQueueItem[]
  meta: ReminderQueueMeta | null
  isLoading: boolean
  error: NormalizedError | null
}

export function useReminderQueue(agencyId: string | null) {
  const [state, setState] = useState<ReminderQueueState>({
    data: [],
    meta: null,
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId) {
      setState({ data: [], meta: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await fetchReminderQueue(agencyId)
      setState({
        data: response.items ?? [],
        meta: response.meta ?? null,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState({
        data: [],
        meta: null,
        isLoading: false,
        error: error as NormalizedError,
      })
    }
  }, [agencyId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
