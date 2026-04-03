export interface GeocodingResult {
  displayName: string
  lat: string
  lon: string
  address?: Record<string, string>
}

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", trimmed)
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "5")

  const response = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "fr",
    },
  })

  if (!response.ok) {
    throw new Error("Impossible de récupérer les résultats.")
  }

  const data = (await response.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    address?: Record<string, string>
  }>

  return data.map((item) => ({
    displayName: item.display_name,
    lat: item.lat,
    lon: item.lon,
    address: item.address,
  }))
}
