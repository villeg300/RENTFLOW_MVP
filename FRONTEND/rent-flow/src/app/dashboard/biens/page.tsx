"use client"

import * as React from "react"

import Link from "next/link"

import {
  ArrowLeftIcon,
  Building2Icon,
  HomeIcon,
  ImageIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import { useBuildings } from "@/hooks/useBuildings"
import { useProperties } from "@/hooks/useProperties"
import {
  createBuilding,
  createListing,
  uploadPropertyImage,
} from "@/services/properties.service"
import type {
  CreateListingPayload,
  Property,
  PropertyImage,
  PropertyType,
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

const listingStatusOptions = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publié" },
  { value: "archived", label: "Archivé" },
]

const propertyTypeOptions = Object.entries(propertyTypeLabels).map(([value, label]) => ({
  value: value as PropertyType,
  label,
}))

type CreateType = "building" | "property" | "listing"

const createTypeLabels: Record<CreateType, string> = {
  building: "Immeuble",
  property: "Bien",
  listing: "Annonce",
}

const createTypeDescriptions: Record<CreateType, string> = {
  building: "Regroupez plusieurs unités dans un même immeuble.",
  property: "Ajoutez un bien avec son loyer et ses caractéristiques.",
  listing: "Publiez une annonce pour un bien disponible.",
}

function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function formatCity(city?: string) {
  if (!city) return null
  return city.trim()
}

export default function BiensPage() {
  const { agencies, activeAgencyId } = useAgencyContext()
  const {
    data: properties,
    isLoading,
    error,
    refresh: refreshProperties,
    create: createProperty,
  } = useProperties({
    agencyId: activeAgencyId,
  })
  const {
    data: buildings,
    refresh: refreshBuildings,
  } = useBuildings(activeAgencyId)

  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<PropertyType | "all">("all")
  const [availabilityFilter, setAvailabilityFilter] = React.useState<
    "all" | "available" | "occupied"
  >("all")
  const [currentPage, setCurrentPage] = React.useState(1)

  const filteredProperties = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return properties.filter((property) => {
      const matchesSearch =
        !query ||
        property.title.toLowerCase().includes(query) ||
        property.address.toLowerCase().includes(query) ||
        property.city.toLowerCase().includes(query)

      const matchesType = typeFilter === "all" || property.property_type === typeFilter
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && property.is_available) ||
        (availabilityFilter === "occupied" && !property.is_available)

      return matchesSearch && matchesType && matchesAvailability
    })
  }, [properties, search, typeFilter, availabilityFilter])

  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / pageSize))
  const paginatedProperties = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProperties.slice(start, start + pageSize)
  }, [currentPage, filteredProperties, pageSize])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [search, typeFilter, availabilityFilter])

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const totalProperties = properties.length
  const availableProperties = properties.filter((item) => item.is_available).length
  const occupiedProperties = totalProperties - availableProperties
  const averageRent = React.useMemo(() => {
    const rents = properties
      .map((item) => formatNumber(item.rent_amount))
      .filter((value): value is number => typeof value === "number")
    if (!rents.length) return null
    return rents.reduce((sum, value) => sum + value, 0) / rents.length
  }, [properties])

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
      }),
    []
  )

  const [createDrawerOpen, setCreateDrawerOpen] = React.useState(false)
  const [createStep, setCreateStep] = React.useState<"choose" | "form">("choose")
  const [createType, setCreateType] = React.useState<CreateType>("property")
  const [propertyLoading, setPropertyLoading] = React.useState(false)
  const [buildingLoading, setBuildingLoading] = React.useState(false)
  const [listingLoading, setListingLoading] = React.useState(false)

  const [propertyError, setPropertyError] = React.useState<string | null>(null)
  const [buildingError, setBuildingError] = React.useState<string | null>(null)
  const [listingError, setListingError] = React.useState<string | null>(null)

  const [propertyImages, setPropertyImages] = React.useState<File[]>([])

  const creationOptions = React.useMemo(
    () => [
      {
        type: "building" as const,
        title: "Immeuble",
        description: createTypeDescriptions.building,
        icon: Building2Icon,
      },
      {
        type: "property" as const,
        title: "Bien immobilier",
        description: createTypeDescriptions.property,
        icon: HomeIcon,
      },
      {
        type: "listing" as const,
        title: "Annonce",
        description: createTypeDescriptions.listing,
        icon: ImageIcon,
      },
    ],
    []
  )

  const [propertyForm, setPropertyForm] = React.useState({
    title: "",
    address: "",
    city: "",
    building: "none",
    property_type: "house" as PropertyType,
    rent_amount: "",
    bedrooms: "",
    bathrooms: "",
    living_rooms: "",
    kitchens: "",
    toilets: "",
    parking_spots: "",
    area_sqm: "",
    furnished: false,
    has_balcony: false,
    has_terrace: false,
    has_garden: false,
    has_storage: false,
    has_elevator: false,
    has_pool: false,
    has_air_conditioning: false,
    water_included: false,
    electricity_included: false,
    internet_included: false,
    security_included: false,
    is_available: true,
    description: "",
  })

  const [buildingForm, setBuildingForm] = React.useState({
    name: "",
    address: "",
    city: "",
    total_floors: "",
    total_units: "",
    year_built: "",
    description: "",
  })

  const [listingForm, setListingForm] = React.useState({
    property: "",
    title: "",
    price: "",
    status: "draft",
    available_from: "",
    public_address: "",
    city: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    is_featured: false,
    description: "",
  })

  const resetPropertyForm = React.useCallback(() => {
    setPropertyForm({
      title: "",
      address: "",
      city: "",
      building: "none",
      property_type: "house",
      rent_amount: "",
      bedrooms: "",
      bathrooms: "",
      living_rooms: "",
      kitchens: "",
      toilets: "",
      parking_spots: "",
      area_sqm: "",
      furnished: false,
      has_balcony: false,
      has_terrace: false,
      has_garden: false,
      has_storage: false,
      has_elevator: false,
      has_pool: false,
      has_air_conditioning: false,
      water_included: false,
      electricity_included: false,
      internet_included: false,
      security_included: false,
      is_available: true,
      description: "",
    })
    setPropertyImages([])
    setPropertyError(null)
  }, [])

  const resetBuildingForm = React.useCallback(() => {
    setBuildingForm({
      name: "",
      address: "",
      city: "",
      total_floors: "",
      total_units: "",
      year_built: "",
      description: "",
    })
    setBuildingError(null)
  }, [])

  const resetListingForm = React.useCallback(() => {
    setListingForm({
      property: "",
      title: "",
      price: "",
      status: "draft",
      available_from: "",
      public_address: "",
      city: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      is_featured: false,
      description: "",
    })
    setListingError(null)
  }, [])

  const openCreateDrawer = React.useCallback((type?: CreateType) => {
    if (type) {
      setCreateType(type)
      setCreateStep("form")
    } else {
      setCreateType("property")
      setCreateStep("choose")
    }
    setCreateDrawerOpen(true)
  }, [])

  const handleDrawerOpenChange = React.useCallback(
    (open: boolean) => {
      setCreateDrawerOpen(open)
      if (!open) {
        setCreateStep("choose")
        setCreateType("property")
        resetPropertyForm()
        resetBuildingForm()
        resetListingForm()
      }
    },
    [resetBuildingForm, resetListingForm, resetPropertyForm]
  )

  const handleRefreshAll = React.useCallback(() => {
    refreshProperties()
    refreshBuildings()
  }, [refreshBuildings, refreshProperties])

  const handleCreateProperty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeAgencyId) return

    const rentValue = Number(propertyForm.rent_amount)
    if (!propertyForm.title.trim() || !propertyForm.address.trim()) {
      setPropertyError("Le titre et l'adresse sont obligatoires.")
      return
    }
    if (!Number.isFinite(rentValue) || rentValue <= 0) {
      setPropertyError("Le montant du loyer est invalide.")
      return
    }

    setPropertyLoading(true)
    setPropertyError(null)

    try {
      const toNumber = (value: string) => (value.trim() ? Number(value) : undefined)
      const payload = {
        title: propertyForm.title.trim(),
        address: propertyForm.address.trim(),
        city: propertyForm.city.trim() || undefined,
        building: propertyForm.building === "none" ? undefined : propertyForm.building,
        property_type: propertyForm.property_type,
        rent_amount: rentValue,
        bedrooms: toNumber(propertyForm.bedrooms),
        bathrooms: toNumber(propertyForm.bathrooms),
        living_rooms: toNumber(propertyForm.living_rooms),
        kitchens: toNumber(propertyForm.kitchens),
        toilets: toNumber(propertyForm.toilets),
        parking_spots: toNumber(propertyForm.parking_spots),
        area_sqm: toNumber(propertyForm.area_sqm),
        furnished: propertyForm.furnished,
        has_balcony: propertyForm.has_balcony,
        has_terrace: propertyForm.has_terrace,
        has_garden: propertyForm.has_garden,
        has_storage: propertyForm.has_storage,
        has_elevator: propertyForm.has_elevator,
        has_pool: propertyForm.has_pool,
        has_air_conditioning: propertyForm.has_air_conditioning,
        water_included: propertyForm.water_included,
        electricity_included: propertyForm.electricity_included,
        internet_included: propertyForm.internet_included,
        security_included: propertyForm.security_included,
        is_available: propertyForm.is_available,
        description: propertyForm.description.trim() || undefined,
      }

      const property = await createProperty(payload)

      if (propertyImages.length) {
        for (let index = 0; index < propertyImages.length; index += 1) {
          const file = propertyImages[index]
          await uploadPropertyImage(activeAgencyId, property.id, file, {
            isPrimary: index === 0,
            sortOrder: index,
          })
        }
        refreshProperties()
      }

      toast.success("Bien créé avec succès.")
      setCreateDrawerOpen(false)
      setCreateStep("choose")
      resetPropertyForm()
    } catch (err: any) {
      setPropertyError(err?.message ?? "Impossible de créer le bien.")
      toast.error("Échec de création du bien.")
    } finally {
      setPropertyLoading(false)
    }
  }

  const handleCreateBuilding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeAgencyId) return

    if (!buildingForm.name.trim() || !buildingForm.address.trim()) {
      setBuildingError("Le nom et l'adresse sont obligatoires.")
      return
    }

    setBuildingLoading(true)
    setBuildingError(null)

    try {
      const toNumber = (value: string) => (value.trim() ? Number(value) : undefined)
      await createBuilding(activeAgencyId, {
        name: buildingForm.name.trim(),
        address: buildingForm.address.trim(),
        city: buildingForm.city.trim() || undefined,
        total_floors: toNumber(buildingForm.total_floors),
        total_units: toNumber(buildingForm.total_units),
        year_built: toNumber(buildingForm.year_built),
        description: buildingForm.description.trim() || undefined,
      })
      toast.success("Immeuble créé avec succès.")
      setCreateDrawerOpen(false)
      setCreateStep("choose")
      resetBuildingForm()
      refreshBuildings()
    } catch (err: any) {
      setBuildingError(err?.message ?? "Impossible de créer l'immeuble.")
      toast.error("Échec de création de l'immeuble.")
    } finally {
      setBuildingLoading(false)
    }
  }

  const handleCreateListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeAgencyId) return

    if (!listingForm.property || !listingForm.title.trim() || !listingForm.price.trim()) {
      setListingError("Le bien, le titre et le prix sont obligatoires.")
      return
    }

    const priceValue = Number(listingForm.price)
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setListingError("Le prix est invalide.")
      return
    }

    setListingLoading(true)
    setListingError(null)

    try {
      const payload: CreateListingPayload = {
        property: listingForm.property,
        title: listingForm.title.trim(),
        price: priceValue,
        status: listingForm.status as CreateListingPayload["status"],
        available_from: listingForm.available_from || undefined,
        description: listingForm.description.trim() || undefined,
        public_address: listingForm.public_address.trim() || undefined,
        city: listingForm.city.trim() || undefined,
        contact_name: listingForm.contact_name.trim() || undefined,
        contact_phone: listingForm.contact_phone.trim() || undefined,
        contact_email: listingForm.contact_email.trim() || undefined,
        is_featured: listingForm.is_featured,
      }

      await createListing(activeAgencyId, payload)
      toast.success("Annonce créée avec succès.")
      setCreateDrawerOpen(false)
      setCreateStep("choose")
      resetListingForm()
    } catch (err: any) {
      setListingError(err?.message ?? "Impossible de créer l'annonce.")
      toast.error("Échec de création de l'annonce.")
    } finally {
      setListingLoading(false)
    }
  }


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
              Les biens apparaîtront après création d&apos;une agence.
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
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="@container/card">
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
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
            <CardDescription>Biens</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger les biens
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground">
              {error.message ?? "Une erreur est survenue."}
            </div>
            <Button type="button" onClick={refreshProperties}>
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
            Gestion des biens
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Biens immobiliers</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCcwIcon className="mr-2 size-4" />
            Actualiser
          </Button>
          <Button type="button" size="sm" onClick={() => openCreateDrawer()}>
            <PlusIcon className="mr-2 size-4" />
            Créer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total biens</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalProperties}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Disponibles</CardDescription>
            <CardTitle className="text-2xl font-semibold">{availableProperties}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Occupés</CardDescription>
            <CardTitle className="text-2xl font-semibold">{occupiedProperties}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Loyer moyen</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {averageRent !== null ? currencyFormatter.format(averageRent) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Parc immobilier</CardTitle>
            <CardDescription>
              Visualisez chaque bien avec son statut et le loyer associé.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un bien..."
                className="pl-8"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as PropertyType | "all")}
            >
              <SelectTrigger className="w-40" size="sm" aria-label="Filtrer par type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {propertyTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={availabilityFilter}
              onValueChange={(value) =>
                setAvailabilityFilter(value as "all" | "available" | "occupied")
              }
            >
              <SelectTrigger className="w-44" size="sm" aria-label="Filtrer disponibilité">
                <SelectValue placeholder="Disponibilité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="available">Disponibles</SelectItem>
                <SelectItem value="occupied">Occupés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredProperties.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Aucun bien ne correspond aux filtres sélectionnés.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedProperties.map((property) => {
                  const buildingName = property.building
                    ? buildings.find((building) => building.id === property.building)?.name
                    : undefined
                  return (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      currencyFormatter={currencyFormatter}
                      buildingName={buildingName}
                    />
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Page {currentPage} sur {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Drawer open={createDrawerOpen} onOpenChange={handleDrawerOpenChange} direction="right">
        <DrawerContent className="w-full sm:max-w-2xl">
          <DrawerHeader className="border-b border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle>
                  {createStep === "choose"
                    ? "Nouvelle création"
                    : `Créer un ${createTypeLabels[createType].toLowerCase()}`}
                </DrawerTitle>
                <DrawerDescription>
                  {createStep === "choose"
                    ? "Choisissez le type de création pour démarrer."
                    : createTypeDescriptions[createType]}
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
              {createStep === "choose" ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {creationOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => {
                          setCreateType(option.type)
                          setCreateStep("form")
                        }}
                        className="group flex h-full flex-col items-start gap-3 rounded-lg border border-border/60 bg-background p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
                      >
                        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-foreground">
                            {option.title}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreateStep("choose")}
                    >
                      <ArrowLeftIcon className="mr-2 size-4" />
                      Choisir un autre type
                    </Button>
                    <Badge variant="secondary">{createTypeLabels[createType]}</Badge>
                  </div>

                  {createType === "property" ? (
                    <form className="grid gap-4" onSubmit={handleCreateProperty}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="property-title">Titre du bien</Label>
                          <Input
                            id="property-title"
                            value={propertyForm.title}
                            onChange={(event) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                            placeholder="Villa Ouaga 2000"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={propertyForm.property_type}
                            onValueChange={(value) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                property_type: value as PropertyType,
                              }))
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
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="property-address">Adresse</Label>
                        <Input
                          id="property-address"
                          value={propertyForm.address}
                          onChange={(event) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              address: event.target.value,
                            }))
                          }
                          placeholder="Rue 12, Secteur 4"
                          required
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="property-city">Ville</Label>
                          <Input
                            id="property-city"
                            value={propertyForm.city}
                            onChange={(event) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                city: event.target.value,
                              }))
                            }
                            placeholder="Ouagadougou"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Immeuble</Label>
                          <Select
                            value={propertyForm.building}
                            onValueChange={(value) =>
                              setPropertyForm((prev) => ({ ...prev, building: value }))
                            }
                          >
                            <SelectTrigger aria-label="Immeuble">
                              <SelectValue placeholder="Aucun" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucun immeuble</SelectItem>
                              {buildings.map((building) => (
                                <SelectItem key={building.id} value={building.id}>
                                  {building.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="property-rent">Loyer (XOF)</Label>
                          <Input
                            id="property-rent"
                            type="number"
                            min={0}
                            value={propertyForm.rent_amount}
                            onChange={(event) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                rent_amount: event.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        {renderNumberInput(
                          "Chambres",
                          "property-bedrooms",
                          propertyForm.bedrooms,
                          (value) =>
                            setPropertyForm((prev) => ({ ...prev, bedrooms: value }))
                        )}
                        {renderNumberInput(
                          "Sdb",
                          "property-bathrooms",
                          propertyForm.bathrooms,
                          (value) =>
                            setPropertyForm((prev) => ({ ...prev, bathrooms: value }))
                        )}
                        {renderNumberInput(
                          "Salon",
                          "property-living",
                          propertyForm.living_rooms,
                          (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              living_rooms: value,
                            }))
                        )}
                        {renderNumberInput(
                          "Cuisine",
                          "property-kitchens",
                          propertyForm.kitchens,
                          (value) =>
                            setPropertyForm((prev) => ({ ...prev, kitchens: value }))
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        {renderNumberInput(
                          "Toilettes",
                          "property-toilets",
                          propertyForm.toilets,
                          (value) =>
                            setPropertyForm((prev) => ({ ...prev, toilets: value }))
                        )}
                        {renderNumberInput(
                          "Parking",
                          "property-parking",
                          propertyForm.parking_spots,
                          (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              parking_spots: value,
                            }))
                        )}
                        {renderNumberInput(
                          "Surface",
                          "property-area",
                          propertyForm.area_sqm,
                          (value) =>
                            setPropertyForm((prev) => ({ ...prev, area_sqm: value }))
                        )}
                        <div className="grid gap-2">
                          <Label htmlFor="property-available">Disponible</Label>
                          <Switch
                            id="property-available"
                            checked={propertyForm.is_available}
                            onCheckedChange={(value) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                is_available: value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="property-description">Description</Label>
                        <Textarea
                          id="property-description"
                          value={propertyForm.description}
                          onChange={(event) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Notes, équipements, informations internes"
                        />
                      </div>

                      <div className="rounded-lg border border-border/60 p-4">
                        <div className="text-sm font-medium">Équipements</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {renderSwitch("Meublé", propertyForm.furnished, (value) =>
                            setPropertyForm((prev) => ({ ...prev, furnished: value }))
                          )}
                          {renderSwitch("Balcon", propertyForm.has_balcony, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              has_balcony: value,
                            }))
                          )}
                          {renderSwitch("Terrasse", propertyForm.has_terrace, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              has_terrace: value,
                            }))
                          )}
                          {renderSwitch("Jardin", propertyForm.has_garden, (value) =>
                            setPropertyForm((prev) => ({ ...prev, has_garden: value }))
                          )}
                          {renderSwitch("Stockage", propertyForm.has_storage, (value) =>
                            setPropertyForm((prev) => ({ ...prev, has_storage: value }))
                          )}
                          {renderSwitch("Ascenseur", propertyForm.has_elevator, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              has_elevator: value,
                            }))
                          )}
                          {renderSwitch("Piscine", propertyForm.has_pool, (value) =>
                            setPropertyForm((prev) => ({ ...prev, has_pool: value }))
                          )}
                          {renderSwitch(
                            "Climatisation",
                            propertyForm.has_air_conditioning,
                            (value) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                has_air_conditioning: value,
                              }))
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 p-4">
                        <div className="text-sm font-medium">Charges incluses</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {renderSwitch("Eau", propertyForm.water_included, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              water_included: value,
                            }))
                          )}
                          {renderSwitch(
                            "Électricité",
                            propertyForm.electricity_included,
                            (value) =>
                              setPropertyForm((prev) => ({
                                ...prev,
                                electricity_included: value,
                              }))
                          )}
                          {renderSwitch("Internet", propertyForm.internet_included, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              internet_included: value,
                            }))
                          )}
                          {renderSwitch("Sécurité", propertyForm.security_included, (value) =>
                            setPropertyForm((prev) => ({
                              ...prev,
                              security_included: value,
                            }))
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Photos</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            setPropertyImages(
                              event.target.files ? Array.from(event.target.files) : []
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {propertyImages.length
                            ? `${propertyImages.length} image(s) sélectionnée(s)`
                            : "Ajoutez des images pour mettre en avant ce bien."}
                        </p>
                      </div>

                      {propertyError ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {propertyError}
                        </div>
                      ) : null}

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={propertyLoading}>
                          {propertyLoading ? "Création..." : "Créer le bien"}
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {createType === "building" ? (
                    <form className="grid gap-4" onSubmit={handleCreateBuilding}>
                      <div className="grid gap-2">
                        <Label htmlFor="building-name">Nom de l'immeuble</Label>
                        <Input
                          id="building-name"
                          value={buildingForm.name}
                          onChange={(event) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Résidence Horizon"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="building-address">Adresse</Label>
                        <Input
                          id="building-address"
                          value={buildingForm.address}
                          onChange={(event) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              address: event.target.value,
                            }))
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
                            value={buildingForm.city}
                            onChange={(event) =>
                              setBuildingForm((prev) => ({
                                ...prev,
                                city: event.target.value,
                              }))
                            }
                            placeholder="Bobo-Dioulasso"
                          />
                        </div>
                        {renderNumberInput(
                          "Étages",
                          "building-floors",
                          buildingForm.total_floors,
                          (value) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              total_floors: value,
                            }))
                        )}
                        {renderNumberInput(
                          "Unités",
                          "building-units",
                          buildingForm.total_units,
                          (value) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              total_units: value,
                            }))
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="building-year">Année de construction</Label>
                        <Input
                          id="building-year"
                          type="number"
                          min={1900}
                          value={buildingForm.year_built}
                          onChange={(event) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              year_built: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="building-description">Description</Label>
                        <Textarea
                          id="building-description"
                          value={buildingForm.description}
                          onChange={(event) =>
                            setBuildingForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Services, équipements, notes"
                        />
                      </div>

                      {buildingError ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {buildingError}
                        </div>
                      ) : null}

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={buildingLoading}>
                          {buildingLoading ? "Création..." : "Créer l'immeuble"}
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {createType === "listing" ? (
                    <form className="grid gap-4" onSubmit={handleCreateListing}>
                      {!properties.length ? (
                        <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                          Commencez par créer un bien avant de publier une annonce.
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        <Label>Bien</Label>
                        <Select
                          value={listingForm.property}
                          onValueChange={(value) =>
                            setListingForm((prev) => ({ ...prev, property: value }))
                          }
                        >
                          <SelectTrigger aria-label="Sélectionner un bien">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="listing-title">Titre de l'annonce</Label>
                        <Input
                          id="listing-title"
                          value={listingForm.title}
                          onChange={(event) =>
                            setListingForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Appartement meublé centre-ville"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="listing-price">Prix (XOF)</Label>
                          <Input
                            id="listing-price"
                            type="number"
                            min={0}
                            value={listingForm.price}
                            onChange={(event) =>
                              setListingForm((prev) => ({
                                ...prev,
                                price: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Statut</Label>
                          <Select
                            value={listingForm.status}
                            onValueChange={(value) =>
                              setListingForm((prev) => ({ ...prev, status: value }))
                            }
                          >
                            <SelectTrigger aria-label="Statut">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {listingStatusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="listing-available">Disponible à partir</Label>
                          <Input
                            id="listing-available"
                            type="date"
                            value={listingForm.available_from}
                            onChange={(event) =>
                              setListingForm((prev) => ({
                                ...prev,
                                available_from: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="listing-public-address">Adresse publique</Label>
                        <Input
                          id="listing-public-address"
                          value={listingForm.public_address}
                          onChange={(event) =>
                            setListingForm((prev) => ({
                              ...prev,
                              public_address: event.target.value,
                            }))
                          }
                          placeholder="Quartier Patte d'oie"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="listing-city">Ville</Label>
                          <Input
                            id="listing-city"
                            value={listingForm.city}
                            onChange={(event) =>
                              setListingForm((prev) => ({ ...prev, city: event.target.value }))
                            }
                            placeholder="Ouagadougou"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              Annonce mise en avant
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Visible en priorité
                            </div>
                          </div>
                          <Switch
                            checked={listingForm.is_featured}
                            onCheckedChange={(value) =>
                              setListingForm((prev) => ({ ...prev, is_featured: value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="listing-contact-name">Contact</Label>
                          <Input
                            id="listing-contact-name"
                            value={listingForm.contact_name}
                            onChange={(event) =>
                              setListingForm((prev) => ({
                                ...prev,
                                contact_name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="listing-contact-phone">Téléphone</Label>
                          <Input
                            id="listing-contact-phone"
                            value={listingForm.contact_phone}
                            onChange={(event) =>
                              setListingForm((prev) => ({
                                ...prev,
                                contact_phone: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="listing-contact-email">Email</Label>
                        <Input
                          id="listing-contact-email"
                          type="email"
                          value={listingForm.contact_email}
                          onChange={(event) =>
                            setListingForm((prev) => ({
                              ...prev,
                              contact_email: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="listing-description">Description</Label>
                        <Textarea
                          id="listing-description"
                          value={listingForm.description}
                          onChange={(event) =>
                            setListingForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Description publique"
                        />
                      </div>

                      {listingError ? (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {listingError}
                        </div>
                      ) : null}

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={listingLoading}>
                          {listingLoading ? "Création..." : "Créer l'annonce"}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  )
}

function PropertyCard({
  property,
  currencyFormatter,
  buildingName,
}: {
  property: Property
  currencyFormatter: Intl.NumberFormat
  buildingName?: string
}) {
  const image = getPrimaryImage(property.images)
  const imageUrl = resolveImageUrl(image?.image)
  const rentValue = formatNumber(property.rent_amount)
  const address = `${property.address}${formatCity(property.city) ? ` • ${property.city}` : ""}`

  return (
    <Card className="group overflow-hidden">
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={property.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/40 to-muted">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="size-6" />
                <span className="text-xs">Aucune image</span>
              </div>
            </div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge variant={property.is_available ? "secondary" : "outline"}>
            {property.is_available ? "Disponible" : "Occupé"}
          </Badge>
          <Badge variant="outline">
            {propertyTypeLabels[property.property_type] ?? property.property_type}
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-3 pt-4">
        <div>
          <div className="text-base font-semibold text-foreground">{property.title}</div>
          <div className="text-xs text-muted-foreground">{address}</div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">Loyer</div>
          <div className="font-semibold text-foreground">
            {rentValue !== null ? currencyFormatter.format(rentValue) : "—"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{property.bedrooms} ch.</span>
          <span>•</span>
          <span>{property.bathrooms} sdb</span>
          <span>•</span>
          <span>
            {formatNumber(property.area_sqm) !== null
              ? `${formatNumber(property.area_sqm)} m²`
              : "Surface ?"}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/biens/${property.id}`}>Voir détail</Link>
        </Button>
        {property.building ? (
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href={`/dashboard/biens/immeubles/${property.building}`}>
              <Building2Icon className="size-3" />
              {buildingName ?? "Immeuble"}
            </Link>
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Building2Icon className="size-3" />
            Indépendant
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}

function renderSwitch(label: string, checked: boolean, onCheckedChange: (value: boolean) => void) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
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
