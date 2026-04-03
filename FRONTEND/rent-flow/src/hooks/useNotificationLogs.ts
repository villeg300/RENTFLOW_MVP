"use client"

import { useCallback, useEffect, useState } from "react"

import type { NormalizedError } from "@/lib/axios"
import {
  fetchNotificationLogs,
  type FetchNotificationLogsParams,
} from "@/services/notifications.service"
import type { NotificationLog } from "@/types/notifications.types"

interface NotificationLogsState {
  data: NotificationLog[]
  isLoading: boolean
  error: NormalizedError | null
}

interface UseNotificationLogsParams
  extends Omit<FetchNotificationLogsParams, "agencyId"> {
  agencyId: string | null
  limit?: number
}

export function useNotificationLogs({
  agencyId,
  status,
  channel,
  templateKey,
  dateFrom,
  dateTo,
  limit,
}: UseNotificationLogsParams) {
  const [state, setState] = useState<NotificationLogsState>({
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
      const logs = await fetchNotificationLogs({
        agencyId,
        status,
        channel,
        templateKey,
        dateFrom,
        dateTo,
      })

      const trimmed = typeof limit === "number" ? logs.slice(0, limit) : logs
      setState({ data: trimmed, isLoading: false, error: null })
    } catch (error) {
      setState({ data: [], isLoading: false, error: error as NormalizedError })
    }
  }, [agencyId, status, channel, templateKey, dateFrom, dateTo, limit])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
