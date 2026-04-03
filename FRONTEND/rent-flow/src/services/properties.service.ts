import { apiClient } from "@/lib/axios"
import type {
  Building,
  CreateBuildingPayload,
  CreateListingPayload,
  CreatePropertyPayload,
  CreateRoomPayload,
  Listing,
  Property,
  PropertyImage,
  PropertyType,
  Room,
} from "@/types/property.types"

export interface FetchPropertiesParams {
  agencyId: string
  propertyType?: PropertyType
  isAvailable?: boolean
  buildingId?: string
}

export interface FetchPropertyImagesParams {
  agencyId: string
  propertyId?: string
}

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: T[] }).results
    if (Array.isArray(results)) return results
  }
  return []
}

export async function fetchProperties(
  params: FetchPropertiesParams
): Promise<Property[]> {
  const { agencyId } = params
  const query: Record<string, string> = {}

  if (params.propertyType) {
    query.property_type = params.propertyType
  }
  if (params.isAvailable !== undefined) {
    query.is_available = params.isAvailable ? "true" : "false"
  }
  if (params.buildingId) {
    query.building_id = params.buildingId
  }

  const { data } = await apiClient.get<Property[] | { results?: Property[] }>(
    "/properties/",
    {
      params: query,
      headers: { "X-Agency-ID": agencyId },
    }
  )

  return normalizeListResponse<Property>(data)
}

export async function createProperty(
  agencyId: string,
  payload: CreatePropertyPayload
): Promise<Property> {
  const { data } = await apiClient.post<Property>("/properties/", payload, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function fetchProperty(
  agencyId: string,
  propertyId: string
): Promise<Property> {
  const { data } = await apiClient.get<Property>(`/properties/${propertyId}/`, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function fetchBuildings(agencyId: string): Promise<Building[]> {
  const { data } = await apiClient.get<Building[] | { results?: Building[] }>(
    "/buildings/",
    {
      headers: { "X-Agency-ID": agencyId },
    }
  )
  return normalizeListResponse<Building>(data)
}

export async function fetchBuilding(
  agencyId: string,
  buildingId: string
): Promise<Building> {
  const { data } = await apiClient.get<Building>(`/buildings/${buildingId}/`, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function createBuilding(
  agencyId: string,
  payload: CreateBuildingPayload
): Promise<Building> {
  const { data } = await apiClient.post<Building>("/buildings/", payload, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function fetchListings(agencyId: string): Promise<Listing[]> {
  const { data } = await apiClient.get<Listing[] | { results?: Listing[] }>(
    "/listings/",
    {
      headers: { "X-Agency-ID": agencyId },
    }
  )
  return normalizeListResponse<Listing>(data)
}

export async function createListing(
  agencyId: string,
  payload: CreateListingPayload
): Promise<Listing> {
  const { data } = await apiClient.post<Listing>("/listings/", payload, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function fetchRooms(
  agencyId: string,
  propertyId?: string
): Promise<Room[]> {
  const query: Record<string, string> = {}
  if (propertyId) {
    query.property_id = propertyId
  }

  const { data } = await apiClient.get<Room[] | { results?: Room[] }>("/rooms/", {
    params: query,
    headers: { "X-Agency-ID": agencyId },
  })
  return normalizeListResponse<Room>(data)
}

export async function createRoom(
  agencyId: string,
  payload: CreateRoomPayload
): Promise<Room> {
  const { data } = await apiClient.post<Room>("/rooms/", payload, {
    headers: { "X-Agency-ID": agencyId },
  })
  return data
}

export async function fetchPropertyImages(
  params: FetchPropertyImagesParams
): Promise<PropertyImage[]> {
  const query: Record<string, string> = {}
  if (params.propertyId) {
    query.property_id = params.propertyId
  }

  const { data } = await apiClient.get<
    PropertyImage[] | { results?: PropertyImage[] }
  >("/property-images/", {
    params: query,
    headers: { "X-Agency-ID": params.agencyId },
  })

  return normalizeListResponse<PropertyImage>(data)
}

export async function uploadPropertyImage(
  agencyId: string,
  propertyId: string,
  file: File,
  options?: { caption?: string; isPrimary?: boolean; sortOrder?: number }
): Promise<PropertyImage> {
  const formData = new FormData()
  formData.append("property", propertyId)
  formData.append("image", file)
  if (options?.caption) formData.append("caption", options.caption)
  if (options?.isPrimary) formData.append("is_primary", "true")
  if (options?.sortOrder !== undefined) {
    formData.append("sort_order", String(options.sortOrder))
  }

  const { data } = await apiClient.post<PropertyImage>("/property-images/", formData, {
    headers: {
      "X-Agency-ID": agencyId,
    },
    transformRequest: (payload, headers) => {
      if (headers) {
        delete headers["Content-Type"]
      }
      return payload
    },
  })

  return data
}
