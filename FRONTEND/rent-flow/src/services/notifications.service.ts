import { apiClient } from "@/lib/axios"
import type {
  BulkReminderResponse,
  NotificationDashboard,
  NotificationLog,
  ReminderQueueItem,
  ReminderQueueResponse,
} from "@/types/notifications.types"

export interface FetchNotificationLogsParams {
  agencyId: string
  status?: string
  channel?: string
  templateKey?: string
  dateFrom?: string
  dateTo?: string
}

export interface FetchNotificationDashboardParams {
  agencyId: string
  dateFrom?: string
  dateTo?: string
}

export interface BulkReminderPayload {
  agencyId: string
  channels: string[]
  message?: string
  dueDate?: string
  overdueMinDays?: number
  overdueMaxDays?: number
  onlyOverdue?: boolean
}

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: T[] }).results
    if (Array.isArray(results)) return results
  }
  return []
}

export async function fetchNotificationLogs(
  params: FetchNotificationLogsParams
): Promise<NotificationLog[]> {
  const { agencyId, status, channel, templateKey, dateFrom, dateTo } = params
  const query: Record<string, string> = {}

  if (status) query.status = status
  if (channel) query.channel = channel
  if (templateKey) query.template_key = templateKey
  if (dateFrom) query.date_from = dateFrom
  if (dateTo) query.date_to = dateTo

  const { data } = await apiClient.get<
    NotificationLog[] | { results?: NotificationLog[] }
  >("/notifications/logs/", {
    params: query,
    headers: { "X-Agency-ID": agencyId },
  })

  return normalizeListResponse<NotificationLog>(data)
}

export async function fetchNotificationDashboard(
  params: FetchNotificationDashboardParams
): Promise<NotificationDashboard> {
  const { agencyId, dateFrom, dateTo } = params
  const query: Record<string, string> = {}

  if (dateFrom && dateTo) {
    query.date_from = dateFrom
    query.date_to = dateTo
  }

  const { data } = await apiClient.get<NotificationDashboard>(
    "/notifications/dashboard/",
    {
      params: query,
      headers: { "X-Agency-ID": agencyId },
    }
  )

  return data
}

export async function sendBulkReminders(
  payload: BulkReminderPayload
): Promise<BulkReminderResponse> {
  const {
    agencyId,
    channels,
    message,
    dueDate,
    overdueMinDays,
    overdueMaxDays,
    onlyOverdue,
  } = payload

  const body: Record<string, unknown> = { channels }
  if (message) body.message = message
  if (dueDate) body.due_date = dueDate
  if (overdueMinDays !== undefined) body.overdue_min_days = overdueMinDays
  if (overdueMaxDays !== undefined) body.overdue_max_days = overdueMaxDays
  if (onlyOverdue !== undefined) body.only_overdue = onlyOverdue

  const { data } = await apiClient.post<BulkReminderResponse>(
    "/notifications/reminders/bulk/",
    body,
    {
      headers: { "X-Agency-ID": agencyId },
    }
  )

  return data
}

export async function fetchReminderQueue(
  agencyId: string
): Promise<ReminderQueueResponse> {
  const { data } = await apiClient.get<
    ReminderQueueItem[] | ReminderQueueResponse
  >(
    "/notifications/reminders/queue/",
    {
      headers: { "X-Agency-ID": agencyId },
    }
  )

  if (Array.isArray(data)) {
    return { items: data }
  }
  if (data && typeof data === "object" && "items" in data) {
    return {
      meta: (data as ReminderQueueResponse).meta,
      items: (data as ReminderQueueResponse).items ?? [],
    }
  }
  return { items: [] }
}
