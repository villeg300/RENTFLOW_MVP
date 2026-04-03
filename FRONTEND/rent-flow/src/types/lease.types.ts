export type LeaseStatus = "active" | "ended" | "cancelled"

export interface Lease {
  id: string
  agency: string
  property: string
  tenant: string | null
  tenant_name: string
  tenant_phone: string
  tenant_email: string
  start_date: string
  end_date: string | null
  rent_amount: number | string
  deposit_amount: number | string
  status: LeaseStatus
  notes: string
  created_at: string
  updated_at: string
}
