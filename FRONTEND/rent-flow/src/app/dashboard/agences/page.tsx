"use client"

import * as React from "react"
import Link from "next/link"

import { Building2Icon, PlusIcon, RefreshCcwIcon } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAgencyContext } from "@/context/AgencyContext"
import { useAuthContext } from "@/context/AuthContext"
import { useAgencies } from "@/hooks/useAgencies"
import type { Agency } from "@/types/agency.types"
import { toast } from "sonner"

const roleLabels: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Manager",
  agent: "Agent",
  viewer: "Observateur",
}

function formatRole(role?: string | null) {
  if (!role) return "—"
  return roleLabels[role] ?? role
}

export default function AgencesPage() {
  const { activeAgencyId, setActiveAgencyId } = useAgencyContext()
  const { refreshUser } = useAuthContext()
  const { data, isLoading, error, refresh, create } = useAgencies()

  const totalMembers = React.useMemo(
    () => data.reduce((sum, agency) => sum + (agency.members_count ?? 0), 0),
    [data]
  )

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createForm, setCreateForm] = React.useState({
    name: "",
    email: "",
    phone_number: "",
    address: "",
  })

  const resetForm = React.useCallback(() => {
    setCreateForm({
      name: "",
      email: "",
      phone_number: "",
      address: "",
    })
    setCreateError(null)
  }, [])

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createForm.name.trim()) {
      setCreateError("Le nom de l'agence est obligatoire.")
      return
    }

    setCreateLoading(true)
    setCreateError(null)

    try {
      const agency = await create({
        name: createForm.name.trim(),
        email: createForm.email.trim() || undefined,
        phone_number: createForm.phone_number.trim() || undefined,
        address: createForm.address.trim() || undefined,
      })

      toast.success("Agence créée avec succès.")
      setCreateOpen(false)
      resetForm()
      setActiveAgencyId(agency.id)
      void refresh()
      void refreshUser()
    } catch (err: any) {
      setCreateError(err?.message ?? "Impossible de créer l'agence.")
      toast.error("Échec de création de l'agence.")
    } finally {
      setCreateLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="@container/card">
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
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
            <CardDescription>Agences</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger les agences
            </CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">Erreur</span>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-2 text-sm">
            <div className="text-muted-foreground">
              {error.message ?? "Une erreur est survenue."}
            </div>
            <Button type="button" onClick={refresh}>
              Réessayer
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!data.length) {
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
              Ajoutez une agence pour commencer à gérer vos biens et vos loyers.
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Créer une agence
            </Button>
          </CardFooter>
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
              <DialogTitle>Nouvelle agence</DialogTitle>
              <DialogDescription>
                Centralisez vos biens et vos collaborateurs dans une même agence.
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleCreateSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="agency-name">Nom de l&apos;agence</Label>
                <Input
                  id="agency-name"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Agence Alpha"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="agency-email">Email</Label>
                  <Input
                    id="agency-email"
                    type="email"
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="contact@agence.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="agency-phone">Téléphone</Label>
                  <Input
                    id="agency-phone"
                    value={createForm.phone_number}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        phone_number: event.target.value,
                      }))
                    }
                    placeholder="+226 70 00 00 00"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agency-address">Adresse</Label>
                <Textarea
                  id="agency-address"
                  value={createForm.address}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  placeholder="Quartier Ouaga 2000"
                />
              </div>
              {createError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {createError}
                </div>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Création..." : "Créer l'agence"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2Icon className="size-4" />
            Organisation
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Agences</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCcwIcon className="mr-2 size-4" />
            Actualiser
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="mr-2 size-4" />
            Nouvelle agence
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total agences</CardDescription>
            <CardTitle className="text-2xl font-semibold">{data.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Membres cumulés</CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalMembers}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Agence active</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {data.find((agency) => agency.id === activeAgencyId)?.name ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((agency) => (
          <AgencyCard
            key={agency.id}
            agency={agency}
            isActive={agency.id === activeAgencyId}
            onActivate={() => setActiveAgencyId(agency.id)}
          />
        ))}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle>Nouvelle agence</DialogTitle>
            <DialogDescription>
              Centralisez vos biens et vos collaborateurs dans une même agence.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="agency-name-main">Nom de l&apos;agence</Label>
              <Input
                id="agency-name-main"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Agence Alpha"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="agency-email-main">Email</Label>
                <Input
                  id="agency-email-main"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="contact@agence.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agency-phone-main">Téléphone</Label>
                <Input
                  id="agency-phone-main"
                  value={createForm.phone_number}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      phone_number: event.target.value,
                    }))
                  }
                  placeholder="+226 70 00 00 00"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="agency-address-main">Adresse</Label>
              <Textarea
                id="agency-address-main"
                value={createForm.address}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder="Quartier Ouaga 2000"
              />
            </div>
            {createError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {createError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "Création..." : "Créer l'agence"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgencyCard({
  agency,
  isActive,
  onActivate,
}: {
  agency: Agency
  isActive: boolean
  onActivate: () => void
}) {
  return (
    <Card className="@container/card">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{agency.name}</CardTitle>
          {isActive ? <Badge>Active</Badge> : null}
        </div>
        <CardDescription>
          {agency.address || "Adresse non renseignée"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Membres</span>
          <span>{agency.members_count ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rôle</span>
          <span>{formatRole(agency.role)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Contact</span>
          <span>{agency.email || agency.phone_number || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Statut</span>
          <Badge variant={agency.is_active ? "secondary" : "outline"}>
            {agency.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        {isActive ? (
          <Badge variant="secondary">Agence sélectionnée</Badge>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onActivate}>
            Définir active
          </Button>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/biens">Voir les biens</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
