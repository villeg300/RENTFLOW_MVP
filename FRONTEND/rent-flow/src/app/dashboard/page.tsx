"use client"

import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { SectionCards } from "@/components/dashboard/section-cards"
import * as React from "react"
import Link from "next/link"
import { BellIcon, FileTextIcon, ReceiptIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ColumnDef } from "@tanstack/react-table"

import { useRecentActivity, type ActivityItem } from "@/hooks/useRecentActivity"
import { useAlerts, type AlertItem } from "@/hooks/useAlerts"
import { useAgencyContext } from "@/context/AgencyContext"

export default function Page() {
  const { activeAgencyId } = useAgencyContext()
  const { data, isLoading } = useRecentActivity(activeAgencyId, 10)
  const { data: alerts, isLoading: alertsLoading } = useAlerts(activeAgencyId, 6)
  const [activityFilter, setActivityFilter] = React.useState<ActivityItem["type"] | "all">("all")

  const filteredData = React.useMemo(() => {
    if (activityFilter === "all") return data
    return data.filter((item) => item.type === activityFilter)
  }, [activityFilter, data])

  const columns: ColumnDef<ActivityItem>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const value = row.original.type
        const label =
          value === "payment"
            ? "Paiement"
            : value === "contract"
              ? "Contrat"
              : value === "tenant"
                ? "Locataire"
                : "Notification"
        const Icon =
          value === "payment"
            ? ReceiptIcon
            : value === "contract"
              ? FileTextIcon
              : value === "tenant"
                ? UsersIcon
                : BellIcon
        return (
          <Badge variant="outline" className="gap-1.5">
            <Icon className="size-3" />
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "title",
      header: "Activité",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-xs text-muted-foreground">{row.original.detail}</span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Montant",
      cell: ({ row }) =>
        row.original.amount !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "XOF",
              maximumFractionDigits: 0,
            }).format(row.original.amount)
          : "—",
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.status ? (
          <span className="text-xs text-muted-foreground">{row.original.status}</span>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            })
          : "—",
    },
  ]

  const alertColumns: ColumnDef<AlertItem>[] = [
    {
      accessorKey: "title",
      header: "Alerte",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge
            variant={row.original.severity === "danger" ? "destructive" : "outline"}
            className="gap-1.5"
          >
            <TriangleAlertIcon className="size-3" />
            {row.original.title}
          </Badge>
          <span className="text-xs text-muted-foreground">{row.original.detail}</span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Montant",
      cell: ({ row }) =>
        row.original.amount !== undefined
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "XOF",
              maximumFractionDigits: 0,
            }).format(row.original.amount)
          : "—",
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.status}</span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            })
          : "—",
    },
  ]

  return (
    // <SidebarProvider
    //   style={
    //     {
    //       "--sidebar-width": "calc(var(--spacing) * 72)",
    //       "--header-height": "calc(var(--spacing) * 12)",
    //     } as React.CSSProperties
    //   }
    // >
    //   <AppSidebar variant="inset" />
    //   <SidebarInset>
    
  
        
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <div className="px-4 lg:px-6">
                <Card className="@container/card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Alertes & actions urgentes
                      <Badge variant={alerts.length ? "destructive" : "outline"}>
                        {alerts.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Paiements en attente/échoués et notifications en échec
                    </CardDescription>
                    <CardAction>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/dashboard/alerts">Voir toutes les alertes</Link>
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    {alertsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <DataTable
                        columns={alertColumns}
                        data={alerts}
                        pageSize={4}
                        initialSorting={[{ id: "date", desc: true }]}
                        emptyMessage="Aucune alerte urgente."
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="px-4 lg:px-6">
                <Card className="@container/card">
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Activités récentes</CardTitle>
                      <CardDescription>
                        Derniers contrats, paiements, locataires et notifications
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={activityFilter}
                        onValueChange={(value) =>
                          setActivityFilter(value as ActivityItem["type"] | "all")
                        }
                      >
                        <SelectTrigger className="w-48" size="sm" aria-label="Filtrer par type">
                          <SelectValue placeholder="Filtrer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous</SelectItem>
                          <SelectItem value="payment">Paiements</SelectItem>
                          <SelectItem value="contract">Contrats</SelectItem>
                          <SelectItem value="tenant">Locataires</SelectItem>
                          <SelectItem value="notification">Notifications</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/dashboard/activities">Voir tout</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <Skeleton key={index} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <DataTable
                        columns={columns}
                        data={filteredData}
                        pageSize={6}
                        initialSorting={[{ id: "date", desc: true }]}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
        
    

    //   {/* </SidebarInset>
    // </SidebarProvider> */}
  )
}
