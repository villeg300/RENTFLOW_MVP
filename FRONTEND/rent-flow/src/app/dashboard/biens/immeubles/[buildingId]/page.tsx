"use client"

import * as React from "react"

import Link from "next/link"
import { useParams } from "next/navigation"

import { Building2Icon, HomeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAgencyContext } from "@/context/AgencyContext"
import { useBuildingDetail } from "@/hooks/useBuildingDetail"
import { useProperties } from "@/hooks/useProperties"
import { getErrorMessage } from "@/lib/error-message"
import type { CreatePropertyPayload, Property, PropertyType } from "@/types/property.types"
import { toast } from "sonner"

const propertyTypeLabels: Record<PropertyType, string> = {
  house: "Maison",
  apartment: "Appartement",
  room: "Chambre",
  land: "Terrain",
  office: "Bureau",
  shop: "Boutique",
  warehouse: "Entrepôt",
}

const propertyTypeOptions = Object.entries(propertyTypeLabels).map(([value, label]) => ({
  value: value as PropertyType,
  label,
}))

function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function BuildingDetailPage() {
  const params = useParams()
  const buildingId = Array.isArray(params.buildingId)
    ? params.buildingId[0]
    : params.buildingId

  const { activeAgencyId } = useAgencyContext()
  const { data: building, isLoading, error, refresh } = useBuildingDetail(
    activeAgencyId,
    buildingId
  )

  const {
    data: units,
    isLoading: unitsLoading,
    refresh: refreshUnits,
    create: createProperty,
    update: updateProperty,
    remove: removeProperty,
  } = useProperties({ agencyId: activeAgencyId, buildingId })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [editingUnitId, setEditingUnitId] = React.useState<string | null>(null)

  const [form, setForm] = React.useState({
    title: "",
    address: "",
    city: "",
    property_type: "apartment" as PropertyType,
    rent_amount: "",
    bedrooms: "",
    bathrooms: "",
    area_sqm: "",
    furnished: false,
    is_available: true,
    description: "",
  })

  const resetForm = React.useCallback(() => {
    setEditingUnitId(null)
    setForm({
      title: "",
      address: "",
      city: "",
      property_type: "apartment",
      rent_amount: "",
      bedrooms: "",
      bathrooms: "",
      area_sqm: "",
      furnished: false,
      is_available: true,
      description: "",
    })
    setCreateError(null)
  }, [])

  const openCreateUnitDialog = React.useCallback(() => {
    resetForm()
    setCreateOpen(true)
  }, [resetForm])

  const openEditUnitDialog = React.useCallback((unit: Property) => {
    setEditingUnitId(unit.id)
    setForm({
      title: unit.title,
      address: unit.address,
      city: unit.city,
      property_type: unit.property_type,
      rent_amount: String(unit.rent_amount ?? ""),
      bedrooms: String(unit.bedrooms ?? ""),
      bathrooms: String(unit.bathrooms ?? ""),
      area_sqm: unit.area_sqm === null ? "" : String(unit.area_sqm),
      furnished: unit.furnished,
      is_available: unit.is_available,
      description: unit.description,
    })
    setCreateError(null)
    setCreateOpen(true)
  }, [])

  const handleDeleteUnit = async (unitId: string) => {
    if (!window.confirm("Supprimer cette unité ?")) return
    try {
      await removeProperty(unitId)
      toast.success("Unité supprimée.")
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de supprimer l’unité."))
    }
  }

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
      }),
    []
  )

  const totalUnits = units.length
  const availableUnits = units.filter((unit) => unit.is_available).length
  const occupiedUnits = totalUnits - availableUnits

  const handleCreateUnit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!buildingId) return

    const rentValue = Number(form.rent_amount)
    if (!form.title.trim() || !form.address.trim()) {
      setCreateError("Le titre et l’adresse sont obligatoires.")
      return
    }
    if (!Number.isFinite(rentValue) || rentValue <= 0) {
      setCreateError("Le montant du loyer est invalide.")
      return
    }

    setCreateLoading(true)
    setCreateError(null)

    try {
      const payload: CreatePropertyPayload = {
        title: form.title.trim(),
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        building: buildingId,
        property_type: form.property_type,
        rent_amount: rentValue,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : undefined,
        furnished: form.furnished,
        is_available: form.is_available,
        description: form.description.trim() || undefined,
      }

      if (editingUnitId) {
        await updateProperty(editingUnitId, payload)
      } else {
        await createProperty(payload)
      }
      toast.success(
        editingUnitId ? "Unité modifiée avec succès." : "Unité créée avec succès."
      )
      setCreateOpen(false)
      resetForm()
      refreshUnits()
    } catch (error) {
      setCreateError(getErrorMessage(error, "Impossible d’enregistrer l’unité."))
      toast.error("Échec d’enregistrement de l’unité.")
    } finally {
      setCreateLoading(false)
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
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!building || error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Immeuble</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger l&apos;immeuble
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HomeIcon className="size-4" />
            Détail de l&apos;immeuble
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{building.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/biens">Retour aux biens</Link>
          </Button>
          <Button type="button" size="sm" onClick={openCreateUnitDialog}>
            <PlusIcon className="mr-2 size-4" />
            Créer une unité
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total unités</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalUnits}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Disponibles</CardDescription>
            <CardTitle className="text-2xl font-semibold">{availableUnits}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Occupées</CardDescription>
            <CardTitle className="text-2xl font-semibold">{occupiedUnits}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Informations générales</CardTitle>
            <CardDescription>Coordonnées de l&apos;immeuble.</CardDescription>
          </div>
          <CardAction>
            <Badge variant={building.is_active ? "secondary" : "outline"}>
              {building.is_active ? "Actif" : "Inactif"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Adresse</span>
            <span className="font-medium">{building.address}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ville</span>
            <span className="font-medium">{building.city || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Étages</span>
            <span className="font-medium">{building.total_floors}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Unités attendues</span>
            <span className="font-medium">{building.total_units}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Année</span>
            <span className="font-medium">{building.year_built ?? "—"}</span>
          </div>
        </CardContent>
        {building.description ? (
          <CardFooter className="text-sm text-muted-foreground">
            {building.description}
          </CardFooter>
        ) : null}
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Unités de l&apos;immeuble</CardTitle>
          <CardDescription>Biens rattachés à cet immeuble.</CardDescription>
        </CardHeader>
        <CardContent>
          {unitsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : units.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  currencyFormatter={currencyFormatter}
                  onEdit={() => openEditUnitDialog(unit)}
                  onDelete={() => handleDeleteUnit(unit.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucune unité enregistrée pour cet immeuble.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle>
              {editingUnitId ? "Modifier l’unité" : "Créer une unité"}
            </DialogTitle>
            <DialogDescription>
              {editingUnitId
                ? "Mettez à jour les informations de cette unité."
                : "Ajoutez une unité directement dans l’immeuble."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateUnit}>
            <div className="grid gap-2">
              <Label htmlFor="unit-title">Titre de l&apos;unité</Label>
              <Input
                id="unit-title"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Appartement 2A"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-address">Adresse</Label>
              <Input
                id="unit-address"
                value={form.address}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder={building.address}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={form.property_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, property_type: value as PropertyType }))
                  }
                >
                  <SelectTrigger aria-label="Type de bien">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-city">Ville</Label>
                <Input
                  id="unit-city"
                  value={form.city}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                  placeholder={building.city || "Ville"}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="unit-rent">Loyer (XOF)</Label>
                <Input
                  id="unit-rent"
                  type="number"
                  min={0}
                  value={form.rent_amount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, rent_amount: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-bedrooms">Chambres</Label>
                <Input
                  id="unit-bedrooms"
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, bedrooms: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-bathrooms">Sdb</Label>
                <Input
                  id="unit-bathrooms"
                  type="number"
                  min={0}
                  value={form.bathrooms}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, bathrooms: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-area">Surface (m²)</Label>
              <Input
                id="unit-area"
                type="number"
                min={0}
                value={form.area_sqm}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, area_sqm: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-description">Description</Label>
              <Textarea
                id="unit-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Notes internes"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-foreground">Disponible</div>
                <div className="text-xs text-muted-foreground">Prête à louer</div>
              </div>
              <Switch
                checked={form.is_available}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_available: value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-foreground">Meublé</div>
                <div className="text-xs text-muted-foreground">Inclure du mobilier</div>
              </div>
              <Switch
                checked={form.furnished}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, furnished: value }))}
              />
            </div>

            {createError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {createError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={createLoading}>
                {createLoading
                  ? "Enregistrement..."
                  : editingUnitId
                    ? "Modifier l’unité"
                    : "Créer l’unité"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UnitCard({
  unit,
  currencyFormatter,
  onEdit,
  onDelete,
}: {
  unit: Property
  currencyFormatter: Intl.NumberFormat
  onEdit: () => void
  onDelete: () => void
}) {
  const rentValue = formatNumber(unit.rent_amount)
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-foreground">{unit.title}</div>
          <div className="text-xs text-muted-foreground">{unit.address}</div>
        </div>
        <Badge variant={unit.is_available ? "secondary" : "outline"}>
          {unit.is_available ? "Disponible" : "Occupé"}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Loyer</span>
        <span className="font-semibold">
          {rentValue !== null ? currencyFormatter.format(rentValue) : "—"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{propertyTypeLabels[unit.property_type] ?? unit.property_type}</span>
        <span>•</span>
        <span>{unit.bedrooms} ch.</span>
        <span>•</span>
        <span>{unit.bathrooms} sdb</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={`/dashboard/biens/${unit.id}`}>
            <Building2Icon className="size-3" />
            Voir le bien
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Modifier l'unité"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Supprimer l'unité"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
