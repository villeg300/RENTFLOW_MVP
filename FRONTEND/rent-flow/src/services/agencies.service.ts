import { apiClient } from "@/lib/axios"
import type { Agency, CreateAgencyPayload } from "@/types/agency.types"

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: T[] }).results
    if (Array.isArray(results)) return results
  }
  return []
}

export async function fetchAgencies(): Promise<Agency[]> {
  const { data } = await apiClient.get<Agency[] | { results?: Agency[] }>("/agencies/")
  return normalizeListResponse<Agency>(data)
}

export async function createAgency(
  payload: CreateAgencyPayload
): Promise<Agency> {
  const { data } = await apiClient.post<Agency>("/agencies/", payload)
  return data
}
