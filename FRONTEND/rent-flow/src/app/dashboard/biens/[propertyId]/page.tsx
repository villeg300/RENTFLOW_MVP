"use client"

import * as React from "react"

import Link from "next/link"
import { useParams } from "next/navigation"

import { HomeIcon, ImageIcon, MapPinIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAgencyContext } from "@/context/AgencyContext"
import { useBuildings } from "@/hooks/useBuildings"
import { useLeases } from "@/hooks/useLeases"
import { usePropertyDetail } from "@/hooks/usePropertyDetail"
import { useRooms } from "@/hooks/useRooms"
import type { Lease } from "@/types/lease.types"
import type {
  CreateRoomPayload,
  PropertyImage,
  PropertyType,
  RoomType,
} from "@/types/property.types"
import { toast } from "sonner"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"

const propertyTypeLabels: Record<PropertyType, string> = {
  house: "Maison",
  apartment: "Appartement",
  room: "Chambre",
  land: "Terrain",
  office: "Bureau",
  shop: "Boutique",
  warehouse: "Entrepôt",
}

const leaseStatusLabels: Record<string, string> = {
  active: "En cours",
  ended: "Achevé",
  cancelled: "Annulé",
}

const roomTypeLabels: Record<RoomType, string> = {
  bedroom: "Chambre",
  bathroom: "Salle de bain",
  living: "Salon",
  kitchen: "Cuisine",
  office: "Bureau",
  storage: "Stockage",
  other: "Autre",
}

function resolveImageUrl(url?: string | null) {
  if (!url) return null
  if (url.startsWith("http")) return url
  return `${apiBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`
}

function getPrimaryImage(images?: PropertyImage[]) {
  if (!images || images.length === 0) return null
  return images.find((image) => image.is_primary) ?? images[0]
}

function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function PropertyDetailPage() {
  const params = useParams()
  const propertyId = Array.isArray(params.propertyId)
    ? params.propertyId[0]
    : params.propertyId

  const { activeAgencyId } = useAgencyContext()
  const { data: property, isLoading, error, refresh } = usePropertyDetail(
    activeAgencyId,
    propertyId
  )
  const { data: leases, isLoading: leasesLoading } = useLeases({
    agencyId: activeAgencyId,
    propertyId,
  })
  const {
    data: rooms,
    isLoading: roomsLoading,
    create: createRoom,
  } = useRooms(activeAgencyId, propertyId)
  const { data: buildings } = useBuildings(activeAgencyId)

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
      }),
    []
  )

  const buildingName = React.useMemo(() => {
    if (!property?.building) return "—"
    return buildings.find((item) => item.id === property.building)?.name ?? "—"
  }, [buildings, property?.building])

  const occupancyTimeline = React.useMemo(() => {
    const now = new Date()
    const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" })
    const monthYearFormatter = new Intl.DateTimeFormat("fr-FR", {
      month: "short",
      year: "numeric",
    })
    const items = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      const isOccupied = leases.some((lease) => {
        if (lease.status === "cancelled") return false
        const start = new Date(lease.start_date)
        const end = lease.end_date ? new Date(lease.end_date) : new Date(9999, 11, 31)
        return start <= monthEnd && end >= monthStart
      })
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: monthFormatter.format(monthDate),
        longLabel: monthYearFormatter.format(monthDate),
        isOccupied,
      }
    })
    const rangeLabel =
      items.length >= 2
        ? `${items[0].longLabel} → ${items[items.length - 1].longLabel}`
        : ""
    return { items, rangeLabel }
  }, [leases])

  const [roomDialogOpen, setRoomDialogOpen] = React.useState(false)
  const [roomLoading, setRoomLoading] = React.useState(false)
  const [roomError, setRoomError] = React.useState<string | null>(null)
  const [roomForm, setRoomForm] = React.useState({
    name: "",
    room_type: "bedroom" as RoomType,
    floor_number: "",
    area_sqm: "",
    has_window: true,
    description: "",
  })

  const resetRoomForm = React.useCallback(() => {
    setRoomForm({
      name: "",
      room_type: "bedroom",
      floor_number: "",
      area_sqm: "",
      has_window: true,
      description: "",
    })
    setRoomError(null)
  }, [])

  const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!propertyId) return

    if (!roomForm.name.trim()) {
      setRoomError("Le nom de la pièce est obligatoire.")
      return
    }

    setRoomLoading(true)
    setRoomError(null)

    try {
      const payload: CreateRoomPayload = {
        property: propertyId,
        name: roomForm.name.trim(),
        room_type: roomForm.room_type,
        floor_number: roomForm.floor_number ? Number(roomForm.floor_number) : undefined,
        area_sqm: roomForm.area_sqm ? Number(roomForm.area_sqm) : undefined,
        has_window: roomForm.has_window,
        description: roomForm.description.trim() || undefined,
      }
      await createRoom(payload)
      toast.success("Pièce ajoutée avec succès.")
      setRoomDialogOpen(false)
      resetRoomForm()
    } catch (err: any) {
      setRoomError(err?.message ?? "Impossible d'ajouter la pièce.")
      toast.error("Échec de création de la pièce.")
    } finally {
      setRoomLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!property || error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Bien</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger le bien
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground">
              {error?.message ?? "Une erreur est survenue."}
            </div>
            <Button type="button" onClick={refresh}>
              Réessayer
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const primaryImage = getPrimaryImage(property.images)
  const mainImageUrl = resolveImageUrl(primaryImage?.image)
  const rentValue = formatNumber(property.rent_amount)
  const areaValue = formatNumber(property.area_sqm)

  const highlightTags = [
    property.furnished ? "Meublé" : null,
    property.has_pool ? "Piscine" : null,
    property.has_air_conditioning ? "Climatisation" : null,
    property.has_garden ? "Jardin" : null,
    property.has_balcony ? "Balcon" : null,
  ].filter(Boolean) as string[]

  const chargesIncluded = [
    property.water_included ? "Eau" : null,
    property.electricity_included ? "Électricité" : null,
    property.internet_included ? "Internet" : null,
    property.security_included ? "Sécurité" : null,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HomeIcon className="size-4" />
            Détail du bien
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{property.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/biens">Retour aux biens</Link>
          </Button>
          <Badge variant={property.is_available ? "secondary" : "outline"}>
            {property.is_available ? "Disponible" : "Occupé"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="@container/card overflow-hidden">
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Image principale et galerie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
              {mainImageUrl ? (
                <img
                  src={mainImageUrl}
                  alt={property.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="size-8" />
                    <span className="text-sm">Aucune image disponible</span>
                  </div>
                </div>
              )}
            </div>
            {property.images && property.images.length > 1 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {property.images.map((image) => {
                  const imageUrl = resolveImageUrl(image.image)
                  return (
                    <div
                      key={image.id}
                      className="aspect-[4/3] overflow-hidden rounded-lg border border-border/60 bg-muted"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={image.caption || property.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
            <CardDescription>Informations clés du bien</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">
                {propertyTypeLabels[property.property_type] ?? property.property_type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Immeuble</span>
              <span className="font-medium">{buildingName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Loyer</span>
              <span className="font-semibold">
                {rentValue !== null ? currencyFormatter.format(rentValue) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Surface</span>
              <span className="font-medium">
                {areaValue !== null ? `${areaValue} m²` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chambres</span>
              <span className="font-medium">{property.bedrooms}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Salles de bain</span>
              <span className="font-medium">{property.bathrooms}</span>
            </div>
            <Separator />
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPinIcon className="mt-0.5 size-4" />
              <div>
                <div className="text-sm font-medium text-foreground">Adresse</div>
                <div className="text-xs text-muted-foreground">
                  {property.address}
                  {property.city ? ` • ${property.city}` : ""}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            {highlightTags.length ? (
              highlightTags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                Aucun équipement spécial signalé.
              </span>
            )}
          </CardFooter>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Timeline d&apos;occupation</CardTitle>
          <CardDescription>Libre / occupé sur les 12 derniers mois.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{occupancyTimeline.rangeLabel}</span>
            <span>12 mois glissants</span>
          </div>
          <div className="flex gap-1">
            {occupancyTimeline.items.map((month) => (
              <div key={month.key} className="flex-1">
                <div
                  className={`h-2 rounded-full ${
                    month.isOccupied ? "bg-emerald-500/80" : "bg-muted"
                  }`}
                  title={`${month.longLabel} • ${month.isOccupied ? "Occupé" : "Libre"}`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{occupancyTimeline.items[0]?.label}</span>
            <span>{occupancyTimeline.items[occupancyTimeline.items.length - 1]?.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500/80" />
              Occupé
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-muted" />
              Libre
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Caractéristiques détaillées</CardTitle>
            <CardDescription>Pièces, équipements et charges incluses.</CardDescription>
          </div>
          <CardAction>
            <Button type="button" size="sm" onClick={() => setRoomDialogOpen(true)}>
              Ajouter une pièce
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Salon" value={property.living_rooms} />
            <DetailItem label="Cuisine" value={property.kitchens} />
            <DetailItem label="Toilettes" value={property.toilets} />
            <DetailItem label="Places parking" value={property.parking_spots} />
            <DetailItem label="Balcon" value={property.has_balcony ? "Oui" : "Non"} />
            <DetailItem label="Terrasse" value={property.has_terrace ? "Oui" : "Non"} />
            <DetailItem label="Jardin" value={property.has_garden ? "Oui" : "Non"} />
            <DetailItem label="Ascenseur" value={property.has_elevator ? "Oui" : "Non"} />
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Charges incluses :</span>
            {chargesIncluded.length ? (
              chargesIncluded.map((charge) => (
                <Badge key={charge} variant="secondary">
                  {charge}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Aucune charge incluse.</span>
            )}
          </div>
          {property.description ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
              {property.description}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Pièces</CardTitle>
          <CardDescription>
            Liste des pièces associées à ce bien.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {roomsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : rooms.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-xl border border-border/60 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{room.name}</span>
                    <Badge variant="outline">
                      {roomTypeLabels[room.room_type] ?? room.room_type}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {room.floor_number !== null ? `Étage ${room.floor_number}` : "Étage —"}
                    <span>•</span>
                    {formatNumber(room.area_sqm) !== null
                      ? `${formatNumber(room.area_sqm)} m²`
                      : "Surface —"}
                    <span>•</span>
                    {room.has_window ? "Fenêtre" : "Sans fenêtre"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucune pièce enregistrée pour ce bien.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Contrats liés</CardTitle>
          <CardDescription>
            Historique des contrats en cours, achevés ou annulés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {leasesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : leases.length ? (
            <div className="space-y-3">
              {leases.map((lease) => (
                <LeaseCard key={lease.id} lease={lease} currencyFormatter={currencyFormatter} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucun contrat trouvé pour ce bien.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={roomDialogOpen}
        onOpenChange={(open) => {
          setRoomDialogOpen(open)
          if (!open) resetRoomForm()
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle>Ajouter une pièce</DialogTitle>
            <DialogDescription>
              Complétez les caractéristiques de la pièce pour ce bien.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateRoom}>
            <div className="grid gap-2">
              <Label htmlFor="room-name">Nom de la pièce</Label>
              <Input
                id="room-name"
                value={roomForm.name}
                onChange={(event) =>
                  setRoomForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Chambre parentale"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={roomForm.room_type}
                  onValueChange={(value) =>
                    setRoomForm((prev) => ({ ...prev, room_type: value as RoomType }))
                  }
                >
                  <SelectTrigger aria-label="Type de pièce">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roomTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room-floor">Étage</Label>
                <Input
                  id="room-floor"
                  type="number"
                  min={0}
                  value={roomForm.floor_number}
                  onChange={(event) =>
                    setRoomForm((prev) => ({ ...prev, floor_number: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="room-area">Surface (m²)</Label>
                <Input
                  id="room-area"
                  type="number"
                  min={0}
                  value={roomForm.area_sqm}
                  onChange={(event) =>
                    setRoomForm((prev) => ({ ...prev, area_sqm: event.target.value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-foreground">Fenêtre</div>
                  <div className="text-xs text-muted-foreground">Apporte de la lumière</div>
                </div>
                <Switch
                  checked={roomForm.has_window}
                  onCheckedChange={(value) =>
                    setRoomForm((prev) => ({ ...prev, has_window: value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room-description">Description</Label>
              <Textarea
                id="room-description"
                value={roomForm.description}
                onChange={(event) =>
                  setRoomForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Notes sur la pièce"
              />
            </div>

            {roomError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {roomError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={roomLoading}>
                {roomLoading ? "Création..." : "Ajouter la pièce"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value ?? "—"}</div>
    </div>
  )
}

function LeaseCard({
  lease,
  currencyFormatter,
}: {
  lease: Lease
  currencyFormatter: Intl.NumberFormat
}) {
  const rentValue = formatNumber(lease.rent_amount)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-foreground">
          {lease.tenant_name || "Locataire"}
        </div>
        <div className="text-xs text-muted-foreground">
          {lease.start_date}
          {lease.end_date ? ` → ${lease.end_date}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold">
          {rentValue !== null ? currencyFormatter.format(rentValue) : "—"}
        </div>
        <Badge variant="outline">
          {leaseStatusLabels[lease.status] ?? lease.status}
        </Badge>
      </div>
    </div>
  )
}
