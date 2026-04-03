import { apiClient } from "@/lib/axios"

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
