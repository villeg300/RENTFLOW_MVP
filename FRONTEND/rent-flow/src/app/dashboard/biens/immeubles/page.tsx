"use client"

import * as React from "react"

import Link from "next/link"

import {
  ArrowLeftIcon,
  Building2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAgencyContext } from "@/context/AgencyContext"
import { useBuildings } from "@/hooks/useBuildings"
import { useProperties } from "@/hooks/useProperties"
import { getErrorMessage } from "@/lib/error-message"
import type { Building } from "@/types/property.types"
import { toast } from "sonner"

export default function ImmeublesPage() {
  const { agencies, activeAgencyId } = useAgencyContext()
  const {
    data: buildings,
    isLoading,
    error,
    refresh: refreshBuildings,
    create: createBuilding,
    update: updateBuilding,
    remove: removeBuilding,
  } = useBuildings(activeAgencyId)
  const { data: properties, refresh: refreshProperties } = useProperties({
    agencyId: activeAgencyId,
  })

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [editingBuildingId, setEditingBuildingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({
    name: "",
    address: "",
    city: "",
    total_floors: "",
    total_units: "",
    year_built: "",
    description: "",
  })

  const resetForm = React.useCallback(() => {
    setEditingBuildingId(null)
    setForm({
      name: "",
      address: "",
      city: "",
      total_floors: "",
      total_units: "",
      year_built: "",
      description: "",
    })
    setFormError(null)
  }, [])

  const handleDrawerChange = React.useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
      if (!open) {
        resetForm()
      }
    },
    [resetForm]
  )

  const openCreateBuildingDrawer = React.useCallback(() => {
    resetForm()
    setDrawerOpen(true)
  }, [resetForm])

  const openEditBuildingDrawer = React.useCallback((building: Building) => {
    setEditingBuildingId(building.id)
    setForm({
      name: building.name,
      address: building.address,
      city: building.city,
      total_floors: String(building.total_floors ?? ""),
      total_units: String(building.total_units ?? ""),
      year_built: building.year_built === null ? "" : String(building.year_built),
      description: building.description,
    })
    setFormError(null)
    setDrawerOpen(true)
  }, [])

  const handleRefreshAll = React.useCallback(() => {
    refreshBuildings()
    refreshProperties()
  }, [refreshBuildings, refreshProperties])

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!window.confirm("Supprimer cet immeuble ?")) return
    try {
      await removeBuilding(buildingId)
      toast.success("Immeuble supprimé.")
      refreshProperties()
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossible de supprimer l’immeuble."))
    }
  }

  const handleCreateBuilding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeAgencyId) return

    if (!form.name.trim() || !form.address.trim()) {
      setFormError("Le nom et l’adresse sont obligatoires.")
      return
    }

    setLoading(true)
    setFormError(null)

    try {
      const toNumber = (value: string) => (value.trim() ? Number(value) : undefined)
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        total_floors: toNumber(form.total_floors),
        total_units: toNumber(form.total_units),
        year_built: toNumber(form.year_built),
        description: form.description.trim() || undefined,
      }
      if (editingBuildingId) {
        await updateBuilding(editingBuildingId, payload)
      } else {
        await createBuilding(payload)
      }
      toast.success(
        editingBuildingId ? "Immeuble modifié avec succès." : "Immeuble créé avec succès."
      )
      setDrawerOpen(false)
      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, "Impossible d’enregistrer l’immeuble."))
      toast.error("Échec d’enregistrement de l’immeuble.")
    } finally {
      setLoading(false)
    }
  }

  const buildingSummaries = React.useMemo(
    () =>
      buildings.map((building) => {
        const units = properties.filter((unit) => unit.building === building.id)
        const availableUnits = units.filter((unit) => unit.is_available).length
        return {
          ...building,
          unitsCount: units.length,
          availableUnits,
        }
      }),
    [buildings, properties]
  )

  const totalBuildings = buildings.length
  const totalUnits = buildingSummaries.reduce((sum, item) => sum + item.unitsCount, 0)
  const totalAvailable = buildingSummaries.reduce(
    (sum, item) => sum + item.availableUnits,
    0
  )
  const occupancyRate = totalUnits
    ? Math.round(((totalUnits - totalAvailable) / totalUnits) * 100)
    : 0

  if (!agencies.length) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Aucune agence</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Créez votre première agence
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-3 text-sm">
            <div className="text-muted-foreground">
              Les immeubles apparaîtront après création d&apos;une agence.
            </div>
            <Button asChild>
              <Link href="/dashboard/agences">Créer une agence</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="@container/card">
              <CardHeader>
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-6 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Immeubles</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger les immeubles
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground">
              {error.message ?? "Une erreur est survenue."}
            </div>
            <Button type="button" onClick={refreshBuildings}>
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
            <Building2Icon className="size-4" />
            Gestion des immeubles
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Immeubles</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCcwIcon className="mr-2 size-4" />
            Actualiser
          </Button>
          <Button type="button" size="sm" onClick={openCreateBuildingDrawer}>
            <PlusIcon className="mr-2 size-4" />
            Créer un immeuble
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Immeubles</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalBuildings}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Unités totales</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalUnits}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Unités disponibles</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalAvailable}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Taux d&apos;occupation</CardDescription>
            <CardTitle className="text-2xl font-semibold">{occupancyRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Liste des immeubles</CardTitle>
            <CardDescription>
              Retrouvez les immeubles et leurs unités associées.
            </CardDescription>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreateBuildingDrawer}
            >
              Nouvel immeuble
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="pb-6">
          {buildingSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {buildingSummaries.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  onEdit={() => openEditBuildingDrawer(building)}
                  onDelete={() => handleDeleteBuilding(building.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Aucun immeuble enregistré pour le moment.
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={handleDrawerChange} direction="right">
        <DrawerContent className="w-full sm:max-w-xl">
          <DrawerHeader className="border-b border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>
                  {editingBuildingId ? "Modifier l’immeuble" : "Nouvel immeuble"}
                </DrawerTitle>
                <DrawerDescription>
                  {editingBuildingId
                    ? "Mettez à jour les informations de cet immeuble."
                    : "Créez un immeuble pour regrouper vos unités immobilières."}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" aria-label="Fermer">
                  <XIcon className="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <form className="grid gap-4" onSubmit={handleCreateBuilding}>
                <div className="grid gap-2">
                  <Label htmlFor="building-name">Nom de l&apos;immeuble</Label>
                  <Input
                    id="building-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Résidence Horizon"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="building-address">Adresse</Label>
                  <Input
                    id="building-address"
                    value={form.address}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address: event.target.value }))
                    }
                    placeholder="Avenue de la Paix"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="building-city">Ville</Label>
                    <Input
                      id="building-city"
                      value={form.city}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, city: event.target.value }))
                      }
                      placeholder="Bobo-Dioulasso"
                    />
                  </div>
                  {renderNumberInput("Étages", "building-floors", form.total_floors, (value) =>
                    setForm((prev) => ({ ...prev, total_floors: value }))
                  )}
                  {renderNumberInput("Unités", "building-units", form.total_units, (value) =>
                    setForm((prev) => ({ ...prev, total_units: value }))
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="building-year">Année de construction</Label>
                  <Input
                    id="building-year"
                    type="number"
                    min={1900}
                    value={form.year_built}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, year_built: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="building-description">Description</Label>
                  <Textarea
                    id="building-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Services, équipements, notes"
                  />
                </div>

                {formError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {formError}
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <ArrowLeftIcon className="mr-2 size-4" />
                    Annuler
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading
                      ? "Enregistrement..."
                      : editingBuildingId
                        ? "Modifier l’immeuble"
                        : "Créer l’immeuble"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function BuildingCard({
  building,
  onEdit,
  onDelete,
}: {
  building: Building & { unitsCount: number; availableUnits: number }
  onEdit: () => void
  onDelete: () => void
}) {
  const occupancyRate = building.unitsCount
    ? Math.round(((building.unitsCount - building.availableUnits) / building.unitsCount) * 100)
    : 0
  return (
    <Card className="border border-border/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{building.name}</CardTitle>
        <CardDescription>
          {building.address}
          {building.city ? ` • ${building.city}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Unités</span>
          <span className="font-medium">{building.unitsCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Disponibles</span>
          <span className="font-medium">{building.availableUnits}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Occupation</span>
          <Badge variant={occupancyRate >= 80 ? "default" : "outline"}>
            {occupancyRate}%
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/biens/immeubles/${building.id}`}>Voir détail</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Modifier l'immeuble"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Supprimer l'immeuble"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/biens/immeubles/${building.id}`}>Créer une unité</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function renderNumberInput(
  label: string,
  id: string,
  value: string,
  onChange: (value: string) => void
) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
