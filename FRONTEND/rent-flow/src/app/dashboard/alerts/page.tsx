"use client"

import * as React from "react"

import { TriangleAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgencyContext } from "@/context/AgencyContext"
import { useAlerts, type AlertItem, type AlertType } from "@/hooks/useAlerts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ColumnDef } from "@tanstack/react-table"

export default function AlertsPage() {
  const { activeAgencyId } = useAgencyContext()
  const { data, isLoading } = useAlerts(activeAgencyId, 50)
  const [alertFilter, setAlertFilter] = React.useState<AlertType | "all">("all")

  const filteredAlerts = React.useMemo(() => {
    if (alertFilter === "all") return data
    return data.filter((item) => item.type === alertFilter)
  }, [alertFilter, data])

  const columns: ColumnDef<AlertItem>[] = [
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
      accessorFn: (row) => row.amount ?? 0,
      id: "amount",
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
      accessorFn: (row) => (row.date ? new Date(row.date).getTime() : 0),
      id: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Alertes</CardTitle>
            <CardDescription>
              Paiements en attente/échoués et notifications en échec
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={alertFilter}
              onValueChange={(value) => setAlertFilter(value as AlertType | "all")}
            >
              <SelectTrigger className="w-44" size="sm" aria-label="Filtrer les alertes">
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="payment">Paiements</SelectItem>
                <SelectItem value="notification">Notifications</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredAlerts}
              pageSize={10}
              initialSorting={[{ id: "date", desc: true }]}
              emptyMessage="Aucune alerte urgente."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
