"use client"

import { useEffect, useState } from "react"

import { apiClient, type NormalizedError } from "@/lib/axios"

export type ActivityType = "payment" | "contract" | "tenant" | "notification"

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  detail: string
  status?: string
  amount?: number
  date: string
}

interface ActivityState {
  data: ActivityItem[]
  isLoading: boolean
  error: NormalizedError | null
}

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: T[] }).results
    if (Array.isArray(results)) {
      return results
    }
  }
  return []
}

export function useRecentActivity(agencyId: string | null, limit = 8) {
  const [state, setState] = useState<ActivityState>({
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
      apiClient.get("/leases/", { headers }),
      apiClient.get("/tenants/", {
        headers,
        params: { ordering: "-created_at" },
      }),
      apiClient.get("/notifications/logs/", { headers }),
    ]

    Promise.allSettled(requests)
      .then((results) => {
        if (!isActive) return

        const [paymentsResult, leasesResult, tenantsResult, notificationsResult] =
          results

        const payments = paymentsResult.status === "fulfilled"
          ? normalizeListResponse<any>(paymentsResult.value.data)
          : []
        const leases = leasesResult.status === "fulfilled"
          ? normalizeListResponse<any>(leasesResult.value.data)
          : []
        const tenants = tenantsResult.status === "fulfilled"
          ? normalizeListResponse<any>(tenantsResult.value.data)
          : []
        const notifications = notificationsResult.status === "fulfilled"
          ? normalizeListResponse<any>(notificationsResult.value.data)
          : []

        const activities: ActivityItem[] = []

        payments.forEach((payment) => {
          activities.push({
            id: payment.id,
            type: "payment",
            title: `Paiement ${payment.reference || payment.id?.slice?.(0, 6) || ""}`.trim(),
            detail: payment.status ? `Statut: ${payment.status}` : "Paiement enregistré",
            status: payment.status,
            amount: Number(payment.amount) || 0,
            date: payment.paid_at || payment.created_at,
          })
        })

        leases.forEach((lease) => {
          activities.push({
            id: lease.id,
            type: "contract",
            title: lease.tenant_name
              ? `Contrat ${lease.tenant_name}`
              : "Nouveau contrat",
            detail: lease.start_date
              ? `Début: ${lease.start_date}`
              : "Contrat enregistré",
            status: lease.status,
            amount: Number(lease.rent_amount) || undefined,
            date: lease.created_at || lease.start_date,
          })
        })

        tenants.forEach((tenant) => {
          activities.push({
            id: tenant.id,
            type: "tenant",
            title: `Locataire ${tenant.full_name}`,
            detail: tenant.phone_number || tenant.email || "Nouveau locataire",
            status: tenant.is_active ? "actif" : "inactif",
            date: tenant.created_at,
          })
        })

        notifications.forEach((notification) => {
          activities.push({
            id: notification.id,
            type: "notification",
            title: notification.template_key
              ? `Notification ${notification.template_key}`
              : "Notification",
            detail: notification.tenant_name
              ? `${notification.tenant_name} • ${notification.channel}`
              : notification.channel || "Notification envoyée",
            status: notification.status,
            date: notification.scheduled_for || notification.sent_at || notification.created_at,
          })
        })

        const sorted = activities
          .filter((item) => item.date)
          .sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
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
