export interface NotificationLog {
  id: string
  agency: string
  lease_id?: string
  tenant_id?: string | null
  property_title?: string
  tenant_name?: string
  channel: string
  template_key: string
  scheduled_for: string
  status: string
  message?: string
  error_message?: string
  sent_at?: string | null
  created_at: string
}

export interface NotificationDashboard {
  period: {
    date_from: string
    date_to: string
  }
  total: number
  by_status: Record<string, number>
  by_channel: Record<string, number>
}

export interface BulkReminderResults {
  sent: number
  failed: number
  skipped: number
}

export interface BulkReminderResponse {
  detail: string
  results: BulkReminderResults
}

export interface ReminderQueueItem {
  id: string
  lease_id: string
  tenant_name: string
  property_title?: string
  rent_amount?: number
  channel?: string | null
  template_key: string
  status: "failed" | "overdue"
  scheduled_for?: string | null
}
