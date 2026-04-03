export type PropertyType =
  | "house"
  | "apartment"
  | "room"
  | "land"
  | "office"
  | "shop"
  | "warehouse"

export type RoomType =
  | "bedroom"
  | "bathroom"
  | "living"
  | "kitchen"
  | "office"
  | "storage"
  | "other"

export type ListingStatus = "draft" | "published" | "archived"

export interface PropertyImage {
  id: string
  property: string
  agency: string
  image: string
  caption: string
  is_primary: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Building {
  id: string
  agency: string
  name: string
  address: string
  city: string
  total_floors: number
  total_units: number
  year_built: number | null
  latitude: number | string | null
  longitude: number | string | null
  description: string
  amenities: string[]
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  agency: string
  property: string
  title: string
  description: string
  public_address: string
  city: string
  latitude: number | string | null
  longitude: number | string | null
  price: number | string
  currency: string
  status: ListingStatus
  published_at: string | null
  available_from: string | null
  contact_name: string
  contact_phone: string
  contact_email: string
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  property: string
  name: string
  room_type: RoomType
  floor_number: number | null
  area_sqm: number | string | null
  has_window: boolean
  description: string
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  agency: string
  building: string | null
  title: string
  address: string
  city: string
  unit_number: string
  floor_number: number | null
  property_type: PropertyType
  bedrooms: number
  bathrooms: number
  living_rooms: number
  kitchens: number
  toilets: number
  parking_spots: number
  area_sqm: number | string | null
  latitude: number | string | null
  longitude: number | string | null
  furnished: boolean
  has_balcony: boolean
  has_terrace: boolean
  has_garden: boolean
  has_storage: boolean
  has_elevator: boolean
  has_pool: boolean
  has_air_conditioning: boolean
  water_included: boolean
  electricity_included: boolean
  internet_included: boolean
  security_included: boolean
  amenities: string[]
  photos: string[]
  rent_amount: number | string
  is_available: boolean
  description: string
  images?: PropertyImage[]
  created_at: string
  updated_at: string
}

export interface CreatePropertyPayload {
  title: string
  address: string
  rent_amount: number
  property_type?: PropertyType
  city?: string
  building?: string | null
  bedrooms?: number
  bathrooms?: number
  living_rooms?: number
  kitchens?: number
  toilets?: number
  parking_spots?: number
  area_sqm?: number
  furnished?: boolean
  has_balcony?: boolean
  has_terrace?: boolean
  has_garden?: boolean
  has_storage?: boolean
  has_elevator?: boolean
  has_pool?: boolean
  has_air_conditioning?: boolean
  water_included?: boolean
  electricity_included?: boolean
  internet_included?: boolean
  security_included?: boolean
  is_available?: boolean
  description?: string
}

export interface CreateBuildingPayload {
  name: string
  address: string
  city?: string
  total_floors?: number
  total_units?: number
  year_built?: number
  description?: string
}

export interface CreateListingPayload {
  property: string
  title: string
  price: number
  status?: ListingStatus
  available_from?: string
  description?: string
  public_address?: string
  city?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  is_featured?: boolean
}

export interface CreateRoomPayload {
  property: string
  name: string
  room_type?: RoomType
  floor_number?: number
  area_sqm?: number
  has_window?: boolean
  description?: string
}
