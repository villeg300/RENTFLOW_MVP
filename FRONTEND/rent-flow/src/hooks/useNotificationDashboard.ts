"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import {
  fetchNotificationDashboard,
  type FetchNotificationDashboardParams,
} from "@/services/notifications.service"
import type { NotificationDashboard } from "@/types/notifications.types"

interface NotificationDashboardState {
  data: NotificationDashboard | null
  isLoading: boolean
  error: NormalizedError | null
}

interface UseNotificationDashboardParams
  extends Omit<FetchNotificationDashboardParams, "agencyId"> {
  agencyId: string | null
}

export function useNotificationDashboard({
  agencyId,
  dateFrom,
  dateTo,
}: UseNotificationDashboardParams) {
  const [state, setState] = useState<NotificationDashboardState>({
    data: null,
    isLoading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!agencyId) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await fetchNotificationDashboard({
        agencyId,
        dateFrom,
        dateTo,
      })
      setState({ data, isLoading: false, error: null })
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
