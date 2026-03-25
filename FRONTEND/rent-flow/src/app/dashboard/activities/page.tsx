"use client"

import * as React from "react"

import { BellIcon, FileTextIcon, ReceiptIcon, UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgencyContext } from "@/context/AgencyContext"
import { useRecentActivity, type ActivityItem } from "@/hooks/useRecentActivity"
import type { ColumnDef } from "@tanstack/react-table"

export default function ActivitiesPage() {
  const { activeAgencyId } = useAgencyContext()
  const { data, isLoading } = useRecentActivity(activeAgencyId, 50)
  const [activityFilter, setActivityFilter] = React.useState<ActivityItem["type"] | "all">("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [periodFilter, setPeriodFilter] = React.useState<"all" | "7d" | "30d" | "90d">("30d")

  const typeLabel = React.useCallback((value: ActivityItem["type"]) => {
    if (value === "payment") return "Paiement"
    if (value === "contract") return "Contrat"
    if (value === "tenant") return "Locataire"
    return "Notification"
  }, [])

  const statusOptions = React.useMemo(() => {
    const unique = new Set<string>()
    data.forEach((item) => {
      if (item.status) unique.add(item.status)
    })
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [data])

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
      }),
    []
  )
  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  )

  const filteredData = React.useMemo(() => {
    let filtered = activityFilter === "all"
      ? data
      : data.filter((item) => item.type === activityFilter)

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter)
    }

    if (periodFilter !== "all") {
      const now = new Date()
      const days = periodFilter === "7d" ? 7 : periodFilter === "30d" ? 30 : 90
      const cutoff = new Date(now)
      cutoff.setDate(now.getDate() - days)
      filtered = filtered.filter((item) => {
        if (!item.date) return false
        return new Date(item.date) >= cutoff
      })
    }

    return filtered
  }, [activityFilter, data, periodFilter, statusFilter])

  const columns: ColumnDef<ActivityItem>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const value = row.original.type
        const label = typeLabel(value)
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
      accessorFn: (row) => row.amount ?? 0,
      id: "amount",
      header: "Montant",
      cell: ({ row }) =>
        row.original.amount !== undefined
          ? currencyFormatter.format(row.original.amount)
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
      accessorFn: (row) => (row.date ? new Date(row.date).getTime() : 0),
      id: "date",
      header: "Date",
      cell: ({ row }) =>
        row.original.date
          ? dateFormatter.format(new Date(row.original.date))
          : "—",
    },
  ]

  const handleExport = () => {
    if (!filteredData.length) return
    const headers = ["Type", "Activité", "Détails", "Montant", "Statut", "Date"]
    const rows = filteredData.map((item) => [
      typeLabel(item.type),
      item.title,
      item.detail,
      item.amount !== undefined ? currencyFormatter.format(item.amount) : "",
      item.status ?? "",
      item.date ? dateFormatter.format(new Date(item.date)) : "",
    ])
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "activites.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Activités</CardTitle>
            <CardDescription>
              Historique complet des contrats, paiements, locataires et notifications
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" size="sm" aria-label="Filtrer par statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as "all" | "7d" | "30d" | "90d")}>
              <SelectTrigger className="w-40" size="sm" aria-label="Filtrer par période">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
                <SelectItem value="90d">90 jours</SelectItem>
                <SelectItem value="all">Tout</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              Export CSV
            </Button>
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
              data={filteredData}
              pageSize={10}
              initialSorting={[{ id: "date", desc: true }]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
