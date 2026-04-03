"use client"

import * as React from "react"

import dynamic from "next/dynamic"
import { MapPinIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { searchAddress, type GeocodingResult } from "@/services/geocoding.service"

const LeafletMap = dynamic(
  async () => {
    const module = await import("@/components/maps/leaflet-map")
    return module.LeafletMap
  },
  { ssr: false }
)

export interface LocationValue {
  latitude: string
  longitude: string
}

interface PropertyLocationPickerProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  addressHint?: string
}

export function PropertyLocationPicker({
  value,
  onChange,
  addressHint,
}: PropertyLocationPickerProps) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GeocodingResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const coords = React.useMemo(() => {
    const lat = Number(value.latitude)
    const lng = Number(value.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
    return null
  }, [value.latitude, value.longitude])

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Entrez une adresse ou un lieu.")
      setResults([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await searchAddress(query)
      setResults(data)
      if (!data.length) {
        setError("Aucun résultat trouvé.")
      }
    } catch (err: any) {
      setError(err?.message ?? "Recherche impossible.")
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (item: GeocodingResult) => {
    onChange({ latitude: item.lat, longitude: item.lon })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>Rechercher une adresse</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={addressHint ?? "Quartier, rue, ville"}
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleSearch}>
            {loading ? "Recherche..." : "Rechercher"}
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      {results.length ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Résultats ({results.length})
          </div>
          <div className="mt-2 space-y-2">
            {results.map((result) => (
              <button
                key={`${result.lat}-${result.lon}`}
                type="button"
                onClick={() => handleSelect(result)}
                className="flex w-full items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-left text-xs transition hover:border-primary/40"
              >
                <MapPinIcon className="mt-0.5 size-3 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">
                  {result.displayName}
                </span>
                <Badge variant="secondary">Utiliser</Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="property-latitude">Latitude</Label>
          <Input
            id="property-latitude"
            value={value.latitude}
            onChange={(event) => onChange({ ...value, latitude: event.target.value })}
            placeholder="12.3714"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="property-longitude">Longitude</Label>
          <Input
            id="property-longitude"
            value={value.longitude}
            onChange={(event) => onChange({ ...value, longitude: event.target.value })}
            placeholder="-1.5197"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Cliquer sur la carte pour placer le marqueur.</span>
          <span>{coords ? "Position définie" : "Aucune position"}</span>
        </div>
        <LeafletMap
          value={coords}
          onChange={(next) =>
            onChange({
              latitude: next.lat.toString(),
              longitude: next.lng.toString(),
            })
          }
          height={240}
        />
      </div>
    </div>
  )
}
