import { apiClient } from "@/lib/axios"
import type { Lease } from "@/types/lease.types"

export interface FetchLeasesParams {
  agencyId: string
  propertyId?: string
  status?: string
}

export interface LeaseReminderPayload {
  agencyId: string
  leaseId: string
  channels: string[]
  message?: string
}

export interface LeaseReminderResponse {
  detail: string
  results: {
    sent: number
    failed: number
    skipped: number
  }
}

export async function sendLeaseReminder(
  payload: LeaseReminderPayload
): Promise<LeaseReminderResponse> {
  const { agencyId, leaseId, channels, message } = payload
  const body: Record<string, unknown> = { channels }

  if (message) body.message = message

  const { data } = await apiClient.post<LeaseReminderResponse>(
    `/leases/${leaseId}/remind/`,
    body,
    {
      headers: { "X-Agency-ID": agencyId },
    }
  )

  return data
}

export async function fetchLeases(
  params: FetchLeasesParams
): Promise<Lease[]> {
  const { agencyId, propertyId, status } = params
  const query: Record<string, string> = {}

  if (propertyId) query.property_id = propertyId
  if (status) query.status = status

  const { data } = await apiClient.get<Lease[] | { results?: Lease[] }>(
    "/leases/",
    {
      params: query,
      headers: { "X-Agency-ID": agencyId },
    }
  )

  if (Array.isArray(data)) return data
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results?: Lease[] }).results ?? []
  }
  return []
}
