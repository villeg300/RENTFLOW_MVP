export type AgencyRole = "owner" | "manager" | "agent" | "viewer"

export interface Agency {
  id: string
  name: string
  slug: string
  email: string
  phone_number: string
  address: string
  is_active: boolean
  created_at: string
  updated_at: string
  members_count?: number
  role?: AgencyRole | null
}

export interface CreateAgencyPayload {
  name: string
  email?: string
  phone_number?: string
  address?: string
}
