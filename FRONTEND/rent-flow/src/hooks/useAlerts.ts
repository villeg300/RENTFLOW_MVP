"use client"

import { useEffect, useState } from "react"

import { apiClient, type NormalizedError } from "@/lib/axios"

export type AlertType = "payment" | "notification"

export interface AlertItem {
  id: string
  type: AlertType
  title: string
  detail: string
  status: string
  date: string
  amount?: number
  severity: "warning" | "danger"
}

interface AlertState {
  data: AlertItem[]
  isLoading: boolean
  error: NormalizedError | null
}

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: T[] }).results
    if (Array.isArray(results)) return results
  }
  return []
}

export function useAlerts(agencyId: string | null, limit = 6) {
  const [state, setState] = useState<AlertState>({
    data: [],
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    if (!agencyId) {
      setState({ data: [], isLoading: false, error: null })
      return
    }

    let isActive = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    const headers = { "X-Agency-ID": agencyId }

    const requests = [
      apiClient.get("/payments/", { headers }),
      apiClient.get("/notifications/logs/", { headers, params: { status: "failed" } }),
      apiClient.get("/notifications/logs/", { headers, params: { status: "pending" } }),
    ]

    Promise.allSettled(requests)
      .then((results) => {
        if (!isActive) return

        const [paymentsResult, notifFailedResult, notifPendingResult] = results

        const payments = paymentsResult.status === "fulfilled"
          ? normalizeListResponse<any>(paymentsResult.value.data)
          : []
        const failedNotifs = notifFailedResult.status === "fulfilled"
          ? normalizeListResponse<any>(notifFailedResult.value.data)
          : []
        const pendingNotifs = notifPendingResult.status === "fulfilled"
          ? normalizeListResponse<any>(notifPendingResult.value.data)
          : []

        const alerts: AlertItem[] = []

        payments
          .filter((payment: any) => ["pending", "failed"].includes(payment.status))
          .forEach((payment: any) => {
            const isFailed = payment.status === "failed"
            alerts.push({
              id: payment.id,
              type: "payment",
              title: isFailed ? "Paiement échoué" : "Paiement en attente",
              detail: payment.reference
                ? `Référence: ${payment.reference}`
                : "Aucune référence",
              status: payment.status,
              amount: Number(payment.amount) || 0,
              date: payment.paid_at || payment.created_at,
              severity: isFailed ? "danger" : "warning",
            })
          })

        failedNotifs.forEach((log: any) => {
          alerts.push({
            id: log.id,
            type: "notification",
            title: "Notification échouée",
            detail: log.tenant_name
              ? `${log.tenant_name} • ${log.channel}`
              : log.channel || "Notification",
            status: log.status,
            date: log.scheduled_for || log.sent_at || log.created_at,
            severity: "danger",
          })
        })

        pendingNotifs.forEach((log: any) => {
          alerts.push({
            id: log.id,
            type: "notification",
            title: "Notification en attente",
            detail: log.tenant_name
              ? `${log.tenant_name} • ${log.channel}`
              : log.channel || "Notification",
            status: log.status,
            date: log.scheduled_for || log.sent_at || log.created_at,
            severity: "warning",
          })
        })

        const sorted = alerts
          .filter((item) => item.date)
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, limit)

        setState({ data: sorted, isLoading: false, error: null })
      })
      .catch((error) => {
        if (!isActive) return
        setState({ data: [], isLoading: false, error: error as NormalizedError })
      })

    return () => {
      isActive = false
    }
  }, [agencyId, limit])

  return state
}
