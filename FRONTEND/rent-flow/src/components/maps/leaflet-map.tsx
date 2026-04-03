"use client"

import * as React from "react"

import L from "leaflet"
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png"
import iconUrl from "leaflet/dist/images/marker-icon.png"
import shadowUrl from "leaflet/dist/images/marker-shadow.png"
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet"

const defaultCenter: [number, number] = [12.3714, -1.5197]

const markerIcon = L.icon({
  iconRetinaUrl: typeof iconRetinaUrl === "string" ? iconRetinaUrl : iconRetinaUrl.src,
  iconUrl: typeof iconUrl === "string" ? iconUrl : iconUrl.src,
  shadowUrl: typeof shadowUrl === "string" ? shadowUrl : shadowUrl.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

interface LeafletMapProps {
  value: { lat: number; lng: number } | null
  onChange: (value: { lat: number; lng: number }) => void
  height?: number
}

function Recenter({ value }: { value: { lat: number; lng: number } | null }) {
  const map = useMap()
  React.useEffect(() => {
    if (!value) return
    map.setView([value.lat, value.lng], map.getZoom(), { animate: true })
  }, [map, value])
  return null
}

export function LeafletMap({ value, onChange, height = 240 }: LeafletMapProps) {
  const center = value ? ([value.lat, value.lng] as [number, number]) : defaultCenter

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="w-full rounded-xl border border-border/60"
      style={{ height }}
      whenReady={(map) => {
        map.target.on("click", (event: L.LeafletMouseEvent) => {
          onChange({ lat: event.latlng.lat, lng: event.latlng.lng })
        })
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {value ? <Marker position={center} icon={markerIcon} /> : null}
      <Recenter value={value} />
    </MapContainer>
  )
}
