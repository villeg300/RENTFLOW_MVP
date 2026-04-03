"use client"

import * as React from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTable } from "@/components/ui/data-table"
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
import { useNotificationDashboard } from "@/hooks/useNotificationDashboard"
import { useNotificationLogs } from "@/hooks/useNotificationLogs"
import { useReminderQueue } from "@/hooks/useReminderQueue"
import { sendLeaseReminder } from "@/services/leases.service"
import { sendBulkReminders } from "@/services/notifications.service"
import type { NotificationLog, ReminderQueueItem } from "@/types/notifications.types"
import type { ColumnDef } from "@tanstack/react-table"

const statusLabels: Record<string, string> = {
  pending: "En attente",
  sent: "Envoyée",
  failed: "Échouée",
}

const channelLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
}

const templateLabels: Record<string, string> = {
  rent_reminder: "Rappel de loyer",
  payment_receipt: "Reçu de paiement",
  welcome: "Bienvenue",
  rent_due_soon: "Loyer bientôt dû",
  rent_due_today: "Loyer dû aujourd'hui",
  rent_overdue: "Loyer en retard",
  bulk_reminder: "Relance groupée",
  manual_reminder: "Relance manuelle",
}

const statusConfig = {
  sent: { label: "Envoyées", color: "var(--chart-2)" },
  pending: { label: "En attente", color: "var(--chart-4)" },
  failed: { label: "Échouées", color: "var(--chart-5)" },
} satisfies ChartConfig

const channelConfig = {
  email: { label: "Email", color: "var(--chart-1)" },
  sms: { label: "SMS", color: "var(--chart-3)" },
  whatsapp: { label: "WhatsApp", color: "var(--chart-4)" },
} satisfies ChartConfig

function formatTemplate(templateKey: string) {
  return templateLabels[templateKey] ?? templateKey.replace(/_/g, " ")
}

type ReminderItem = {
  id: string
  leaseId: string
  tenantName: string
  propertyTitle?: string
  amount?: number
  channel?: string
  templateKey: string
  status: "failed" | "overdue"
  scheduledFor?: string
}

export default function NotificationsPage() {
  const { agencies, activeAgencyId } = useAgencyContext()

  const [logStatus, setLogStatus] = React.useState("all")
  const [logChannel, setLogChannel] = React.useState("all")
  const [logTemplate, setLogTemplate] = React.useState("all")
  const [logDateFrom, setLogDateFrom] = React.useState("")
  const [logDateTo, setLogDateTo] = React.useState("")

  const [dashboardFrom, setDashboardFrom] = React.useState("")
  const [dashboardTo, setDashboardTo] = React.useState("")

  const [bulkChannels, setBulkChannels] = React.useState({
    email: true,
    sms: true,
    whatsapp: false,
  })
  const [bulkMessage, setBulkMessage] = React.useState("")
  const [bulkDueDate, setBulkDueDate] = React.useState("")
  const [bulkOnlyOverdue, setBulkOnlyOverdue] = React.useState(true)
  const [bulkMinDays, setBulkMinDays] = React.useState("")
  const [bulkMaxDays, setBulkMaxDays] = React.useState("")
  const [bulkResult, setBulkResult] = React.useState<{
    sent: number
    failed: number
    skipped: number
  } | null>(null)
  const [bulkError, setBulkError] = React.useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false)

  const [singleDialogOpen, setSingleDialogOpen] = React.useState(false)
  const [activeReminder, setActiveReminder] = React.useState<ReminderItem | null>(null)
  const [singleChannels, setSingleChannels] = React.useState({
    email: true,
    sms: false,
    whatsapp: false,
  })
  const [singleMessage, setSingleMessage] = React.useState("")
  const [singleResult, setSingleResult] = React.useState<{
    sent: number
    failed: number
    skipped: number
  } | null>(null)
  const [singleError, setSingleError] = React.useState<string | null>(null)
  const [singleLoading, setSingleLoading] = React.useState(false)
  const [reminderStatusFilter, setReminderStatusFilter] = React.useState("all")
  const [reminderChannelFilter, setReminderChannelFilter] = React.useState("all")

  const bulkChannelSummary = React.useMemo(() => {
    const selected = Object.entries(bulkChannels)
      .filter(([, enabled]) => enabled)
      .map(([key]) => channelLabels[key] ?? key)
    return selected.length ? selected.join(", ") : "Aucun canal"
  }, [bulkChannels])

  const bulkFiltersSummary = React.useMemo(() => {
    const parts: string[] = []
    if (bulkDueDate) parts.push(`Date d'échéance: ${bulkDueDate}`)
    if (bulkOnlyOverdue) parts.push("Uniquement les retards")
    if (bulkMinDays) parts.push(`Retard min: ${bulkMinDays}j`)
    if (bulkMaxDays) parts.push(`Retard max: ${bulkMaxDays}j`)
    return parts.length ? parts.join(" • ") : "Aucun filtre spécifique"
  }, [bulkDueDate, bulkOnlyOverdue, bulkMinDays, bulkMaxDays])

  const dashboardParams = React.useMemo(
    () =>
      dashboardFrom && dashboardTo
        ? { dateFrom: dashboardFrom, dateTo: dashboardTo }
        : {},
    [dashboardFrom, dashboardTo]
  )

  const {
    data: dashboard,
    isLoading: dashboardLoading,
    error: dashboardError,
    refresh: refreshDashboard,
  } = useNotificationDashboard({
    agencyId: activeAgencyId,
    ...dashboardParams,
  })

  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
    refresh: refreshLogs,
  } = useNotificationLogs({
    agencyId: activeAgencyId,
    status: logStatus === "all" ? undefined : logStatus,
    channel: logChannel === "all" ? undefined : logChannel,
    templateKey: logTemplate === "all" ? undefined : logTemplate,
    dateFrom: logDateFrom || undefined,
    dateTo: logDateTo || undefined,
    limit: 100,
  })

  const {
    data: reminderQueue,
    isLoading: remindersLoading,
    error: remindersError,
    refresh: refreshReminders,
  } = useReminderQueue(activeAgencyId)

  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  )

  const dateTimeFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  )

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
      }),
    []
  )

  const statusData = [
    { name: "sent", value: dashboard?.by_status?.sent ?? 0 },
    { name: "pending", value: dashboard?.by_status?.pending ?? 0 },
    { name: "failed", value: dashboard?.by_status?.failed ?? 0 },
  ]

  const channelData = [
    { name: "email", value: dashboard?.by_channel?.email ?? 0 },
    { name: "sms", value: dashboard?.by_channel?.sms ?? 0 },
    { name: "whatsapp", value: dashboard?.by_channel?.whatsapp ?? 0 },
  ]

  const columns: ColumnDef<NotificationLog>[] = [
    {
      accessorKey: "template_key",
      header: "Notification",
      cell: ({ row }) => {
        const log = row.original
        const detail = [log.tenant_name, log.property_title].filter(Boolean).join(" • ")
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{formatTemplate(log.template_key)}</span>
            <span className="text-xs text-muted-foreground">
              {log.error_message ? `Erreur: ${log.error_message}` : detail || "—"}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "channel",
      header: "Canal",
      cell: ({ row }) => (
        <Badge variant="outline">
          {channelLabels[row.original.channel] ?? row.original.channel}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status
        const variant =
          status === "failed" ? "destructive" : status === "pending" ? "outline" : "secondary"
        return <Badge variant={variant}>{statusLabels[status] ?? status}</Badge>
      },
    },
    {
      accessorKey: "scheduled_for",
      header: "Programmée",
      cell: ({ row }) =>
        row.original.scheduled_for
          ? dateFormatter.format(new Date(row.original.scheduled_for))
          : "—",
    },
    {
      accessorKey: "sent_at",
      header: "Envoyée",
      cell: ({ row }) =>
        row.original.sent_at
          ? dateTimeFormatter.format(new Date(row.original.sent_at))
          : "—",
    },
  ]

  const reminders = React.useMemo(() => {
    const mapped = reminderQueue.map((item: ReminderQueueItem) => ({
      id: item.id,
      leaseId: item.lease_id,
      tenantName: item.tenant_name,
      propertyTitle: item.property_title,
      amount: item.rent_amount ?? undefined,
      channel: item.channel ?? undefined,
      templateKey: item.template_key,
      status: item.status,
      scheduledFor: item.scheduled_for ?? undefined,
    }))
    return mapped.sort((a, b) => {
      const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0
      const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0
      return bTime - aTime
    })
  }, [reminderQueue])

  const remindersCount = React.useMemo(() => {
    const failed = reminders.filter((item) => item.status === "failed").length
    const overdue = reminders.filter((item) => item.status === "overdue").length
    return { total: reminders.length, failed, overdue }
  }, [reminders])

  const filteredReminders = React.useMemo(() => {
    return reminders.filter((item) => {
      if (reminderStatusFilter !== "all" && item.status !== reminderStatusFilter) {
        return false
      }
      if (reminderChannelFilter === "all") return true
      if (reminderChannelFilter === "none") return !item.channel
      return item.channel === reminderChannelFilter
    })
  }, [reminders, reminderStatusFilter, reminderChannelFilter])

  const reminderColumns: ColumnDef<ReminderItem>[] = [
    {
      accessorKey: "tenantName",
      header: "Locataire",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">
            {row.original.tenantName}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.propertyTitle || "Bien non renseigné"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Montant",
      cell: ({ row }) =>
        row.original.amount !== undefined
          ? currencyFormatter.format(row.original.amount)
          : "—",
    },
    {
      accessorKey: "templateKey",
      header: "Type",
      cell: ({ row }) =>
        row.original.templateKey === "overdue_payment"
          ? "Paiement en retard"
          : formatTemplate(row.original.templateKey),
    },
    {
      accessorKey: "channel",
      header: "Canal",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.channel
            ? channelLabels[row.original.channel] ?? row.original.channel
            : "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status
        if (status === "overdue") {
          return <Badge variant="destructive">En retard</Badge>
        }
        const variant = status === "failed" ? "destructive" : "outline"
        return <Badge variant={variant}>Échec</Badge>
      },
    },
    {
      accessorFn: (row) =>
        row.scheduledFor ? new Date(row.scheduledFor).getTime() : 0,
      id: "scheduledFor",
      header: "Date",
      cell: ({ row }) =>
        row.original.scheduledFor
          ? dateFormatter.format(new Date(row.original.scheduledFor))
          : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openSingleDialog(row.original)}
          disabled={!row.original.leaseId}
        >
          Relancer
        </Button>
      ),
    },
  ]

  function openSingleDialog(item: ReminderItem) {
    const channels = {
      email: item.channel === "email",
      sms: item.channel === "sms",
      whatsapp: item.channel === "whatsapp",
    }
    if (!channels.email && !channels.sms && !channels.whatsapp) {
      channels.email = true
    }
    setActiveReminder(item)
    setSingleChannels(channels)
    setSingleMessage("")
    setSingleResult(null)
    setSingleError(null)
    setSingleDialogOpen(true)
  }

  async function handleSingleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeAgencyId || !activeReminder?.leaseId) return

    const channels = Object.entries(singleChannels)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)

    if (!channels.length) {
      setSingleError("Sélectionnez au moins un canal d'envoi.")
      return
    }

    setSingleLoading(true)
    setSingleError(null)
    setSingleResult(null)

    try {
      const result = await sendLeaseReminder({
        agencyId: activeAgencyId,
        leaseId: activeReminder.leaseId,
        channels,
        message: singleMessage || undefined,
      })
      setSingleResult(result.results)
      refreshLogs()
      refreshReminders()
      const summary = `Envoyées: ${result.results.sent} • Échouées: ${result.results.failed} • Ignorées: ${result.results.skipped}`
      if (result.results.sent > 0 && result.results.failed === 0) {
        toast.success("Relance envoyée", { description: summary })
      } else {
        toast.error("Relance incomplète", { description: summary })
      }
      setSingleDialogOpen(false)
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: string }).message)
          : "Une erreur est survenue."
      setSingleError(message)
      toast.error("Relance échouée", { description: message })
      setSingleDialogOpen(false)
    } finally {
      setSingleLoading(false)
    }
  }

  async function handleBulkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeAgencyId) return

    const channels = Object.entries(bulkChannels)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)

    if (!channels.length) {
      setBulkError("Sélectionnez au moins un canal d'envoi.")
      return
    }

    setBulkLoading(true)
    setBulkError(null)
    setBulkResult(null)

    try {
      const result = await sendBulkReminders({
        agencyId: activeAgencyId,
        channels,
        message: bulkMessage || undefined,
        dueDate: bulkDueDate || undefined,
        overdueMinDays: bulkMinDays === "" ? undefined : Number(bulkMinDays),
        overdueMaxDays: bulkMaxDays === "" ? undefined : Number(bulkMaxDays),
        onlyOverdue: bulkOnlyOverdue,
      })
      setBulkResult(result.results)
      refreshLogs()
      refreshReminders()

      const summary = `Envoyées: ${result.results.sent} • Échouées: ${result.results.failed} • Ignorées: ${result.results.skipped}`
      if (result.results.sent > 0 && result.results.failed === 0) {
        toast.success("Relance groupée envoyée", { description: summary })
      } else {
        toast.error("Relance groupée incomplète", { description: summary })
      }
      setBulkDialogOpen(false)
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: string }).message)
          : "Une erreur est survenue."
      setBulkError(message)
      toast.error("Relance groupée échouée", { description: message })
      setBulkDialogOpen(false)
    } finally {
      setBulkLoading(false)
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
              Les notifications apparaîtront après création d&apos;une agence.
            </div>
            <Button asChild>
              <Link href="/dashboard/agences">Créer une agence</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Dashboard notifications</CardTitle>
            <CardDescription>
              Vue globale des envois et de leur état
              {dashboard?.period?.date_from && dashboard?.period?.date_to
                ? ` • ${dateFormatter.format(new Date(dashboard.period.date_from))} → ${dateFormatter.format(
                    new Date(dashboard.period.date_to)
                  )}`
                : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1 text-xs">
              <Label htmlFor="dashboard-from">Du</Label>
              <Input
                id="dashboard-from"
                type="date"
                value={dashboardFrom}
                onChange={(event) => setDashboardFrom(event.target.value)}
                className="min-w-36"
              />
            </div>
            <div className="grid gap-1 text-xs">
              <Label htmlFor="dashboard-to">Au</Label>
              <Input
                id="dashboard-to"
                type="date"
                value={dashboardTo}
                onChange={(event) => setDashboardTo(event.target.value)}
                className="min-w-36"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshDashboard}>
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dashboardLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : dashboardError || !dashboard ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              Impossible de charger le dashboard notifications.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1.6fr]">
              <div className="grid gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="mt-1 text-2xl font-semibold">{dashboard.total}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Notifications sur la période sélectionnée
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="text-xs text-muted-foreground">Répartition rapide</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Envoyées</span>
                      <span className="font-mono font-medium">
                        {dashboard.by_status?.sent ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>En attente</span>
                      <span className="font-mono font-medium">
                        {dashboard.by_status?.pending ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Échouées</span>
                      <span className="font-mono font-medium">
                        {dashboard.by_status?.failed ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs font-medium">Statuts</div>
                  <ChartContainer
                    config={statusConfig}
                    className="mx-auto aspect-auto h-[200px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            nameKey="name"
                            formatter={(value, name) => {
                              const label = statusConfig[name as keyof typeof statusConfig]?.label ?? name
                              return (
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="font-mono font-medium text-foreground tabular-nums">
                                    {Number(value).toLocaleString()}
                                  </span>
                                </div>
                              )
                            }}
                            indicator="dot"
                          />
                        }
                      />
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        strokeWidth={2}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={`var(--color-${entry.name})`} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs font-medium">Canaux</div>
                  <ChartContainer
                    config={channelConfig}
                    className="mx-auto aspect-auto h-[200px] w-full"
                  >
                    <BarChart data={channelData} margin={{ left: 8, right: 8, top: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => channelLabels[value] ?? value}
                      />
                      <YAxis tickLine={false} axisLine={false} width={30} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            nameKey="name"
                            formatter={(value, name) => {
                              const label = channelConfig[name as keyof typeof channelConfig]?.label ?? name
                              return (
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="font-mono font-medium text-foreground tabular-nums">
                                    {Number(value).toLocaleString()}
                                  </span>
                                </div>
                              )
                            }}
                            indicator="dot"
                          />
                        }
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {channelData.map((entry) => (
                          <Cell key={entry.name} fill={`var(--color-${entry.name})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Logs des notifications</CardTitle>
          <CardDescription>
            Historique des envois avec filtres par statut, canal et période
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="grid gap-1 text-xs">
              <Label htmlFor="log-status">Statut</Label>
              <Select value={logStatus} onValueChange={setLogStatus}>
                <SelectTrigger id="log-status" className="w-full" size="sm">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="sent">Envoyées</SelectItem>
                  <SelectItem value="failed">Échouées</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-xs">
              <Label htmlFor="log-channel">Canal</Label>
              <Select value={logChannel} onValueChange={setLogChannel}>
                <SelectTrigger id="log-channel" className="w-full" size="sm">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-xs">
              <Label htmlFor="log-template">Template</Label>
              <Select value={logTemplate} onValueChange={setLogTemplate}>
                <SelectTrigger id="log-template" className="w-full" size="sm">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(templateLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 text-xs">
              <Label htmlFor="log-from">Du</Label>
              <Input
                id="log-from"
                type="date"
                value={logDateFrom}
                onChange={(event) => setLogDateFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-1 text-xs">
              <Label htmlFor="log-to">Au</Label>
              <Input
                id="log-to"
                type="date"
                value={logDateTo}
                onChange={(event) => setLogDateTo(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button type="button" variant="outline" size="sm" onClick={refreshLogs}>
              Actualiser
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLogStatus("all")
                setLogChannel("all")
                setLogTemplate("all")
                setLogDateFrom("")
                setLogDateTo("")
              }}
            >
              Réinitialiser
            </Button>
          </div>
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : logsError ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              Impossible de charger les logs.
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={logs}
              pageSize={10}
              initialSorting={[{ id: "scheduled_for", desc: true }]}
              emptyMessage="Aucun log trouvé."
            />
          )}
        </CardContent>
      </Card>

      <Card className="@container/card">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <CardTitle>Relances à faire</CardTitle>
            <CardDescription>
              Échecs de relance + loyers en retard jamais relancés
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Total: {remindersCount.total}</Badge>
              <Badge variant="destructive">Échecs: {remindersCount.failed}</Badge>
              <Badge variant="secondary">En retard: {remindersCount.overdue}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={reminderStatusFilter}
              onValueChange={setReminderStatusFilter}
            >
              <SelectTrigger className="w-36" size="sm" aria-label="Filtrer statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="failed">Échecs</SelectItem>
                <SelectItem value="overdue">En retard</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={reminderChannelFilter}
              onValueChange={setReminderChannelFilter}
            >
              <SelectTrigger className="w-36" size="sm" aria-label="Filtrer canal">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="none">Non défini</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={refreshReminders}>
              Actualiser
            </Button>
            <Button type="button" onClick={() => setBulkDialogOpen(true)}>
              Relance groupée
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Après une relance, le locataire disparaît de cette liste pour éviter le spam.
          </div>
          {remindersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : remindersError ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              Impossible de charger les relances.
            </div>
          ) : (
            <DataTable
              columns={reminderColumns}
              data={filteredReminders}
              pageSize={8}
              initialSorting={[{ id: "scheduledFor", desc: true }]}
              emptyMessage="Aucune relance à faire."
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          setBulkDialogOpen(open)
          if (!open) {
            setBulkError(null)
            setBulkResult(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Relance groupée</DialogTitle>
            <DialogDescription>
              Envoyer un rappel groupé aux locataires selon vos critères.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleBulkSubmit}>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="text-xs font-medium text-muted-foreground">Ciblage</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="grid gap-1 text-xs">
                  <Label htmlFor="bulk-due-date">Date d&apos;échéance</Label>
                  <Input
                    id="bulk-due-date"
                    type="date"
                    value={bulkDueDate}
                    onChange={(event) => setBulkDueDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-1 text-xs">
                  <Label htmlFor="bulk-min-days">Retard min (jours)</Label>
                  <Input
                    id="bulk-min-days"
                    type="number"
                    min={0}
                    value={bulkMinDays}
                    onChange={(event) => setBulkMinDays(event.target.value)}
                  />
                </div>
                <div className="grid gap-1 text-xs">
                  <Label htmlFor="bulk-max-days">Retard max (jours)</Label>
                  <Input
                    id="bulk-max-days"
                    type="number"
                    min={0}
                    value={bulkMaxDays}
                    onChange={(event) => setBulkMaxDays(event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Switch
                  id="bulk-only-overdue"
                  checked={bulkOnlyOverdue}
                  onCheckedChange={setBulkOnlyOverdue}
                />
                <Label htmlFor="bulk-only-overdue">Uniquement les retards</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Canaux d&apos;envoi</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { key: "email", label: "Email" },
                    { key: "sms", label: "SMS" },
                    { key: "whatsapp", label: "WhatsApp" },
                  ] as const
                ).map((channel) => (
                  <label
                    key={channel.key}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={bulkChannels[channel.key]}
                      onCheckedChange={(value) =>
                        setBulkChannels((prev) => ({
                          ...prev,
                          [channel.key]: value === true,
                        }))
                      }
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-message">Message personnalisé</Label>
              <Textarea
                id="bulk-message"
                value={bulkMessage}
                onChange={(event) => setBulkMessage(event.target.value)}
                placeholder="Rappel: votre loyer de {amount} XOF pour {property_title} est dû le {due_date}."
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser le message par défaut. Variables: {"{tenant_name}"} •{" "}
                {"{amount}"} • {"{property_title}"} • {"{due_date}"} • {"{overdue_days}"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Résumé</span> — Canaux:{" "}
              {bulkChannelSummary} • {bulkFiltersSummary}
            </div>
            {bulkError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {bulkError}
              </div>
            ) : null}
            {bulkResult ? (
              <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Résultat: {bulkResult.sent} envoyées • {bulkResult.failed} échouées •{" "}
                {bulkResult.skipped} ignorées
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={bulkLoading}>
                {bulkLoading ? "Envoi en cours..." : "Envoyer les relances"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={singleDialogOpen}
        onOpenChange={(open) => {
          setSingleDialogOpen(open)
          if (!open) {
            setSingleError(null)
            setSingleResult(null)
            setActiveReminder(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Relance individuelle</DialogTitle>
            <DialogDescription>
              {activeReminder
                ? `Locataire: ${activeReminder.tenantName}${
                    activeReminder.propertyTitle
                      ? ` • ${activeReminder.propertyTitle}`
                    : ""
                  }${
                    activeReminder.amount !== undefined
                      ? ` • ${currencyFormatter.format(activeReminder.amount)}`
                      : ""
                  }`
                : "Envoyer un rappel ciblé"}
            </DialogDescription>
          </DialogHeader>
          {activeReminder ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={activeReminder.status === "failed" ? "destructive" : "secondary"}>
                  {activeReminder.status === "failed" ? "Échec de relance" : "Paiement en retard"}
                </Badge>
                {activeReminder.scheduledFor ? (
                  <Badge variant="outline">
                    Échéance: {dateFormatter.format(new Date(activeReminder.scheduledFor))}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Locataire</div>
                  <div className="font-medium text-foreground">{activeReminder.tenantName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Bien</div>
                  <div className="font-medium text-foreground">
                    {activeReminder.propertyTitle || "Non renseigné"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Montant</div>
                  <div className="font-medium text-foreground">
                    {activeReminder.amount !== undefined
                      ? currencyFormatter.format(activeReminder.amount)
                      : "—"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium text-foreground">
                    {activeReminder.templateKey === "overdue_payment"
                      ? "Paiement en retard"
                      : formatTemplate(activeReminder.templateKey)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <form className="grid gap-4" onSubmit={handleSingleSubmit}>
            <div className="grid gap-2">
              <Label>Canaux d&apos;envoi</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { key: "email", label: "Email" },
                    { key: "sms", label: "SMS" },
                    { key: "whatsapp", label: "WhatsApp" },
                  ] as const
                ).map((channel) => (
                  <label
                    key={channel.key}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={singleChannels[channel.key]}
                      onCheckedChange={(value) =>
                        setSingleChannels((prev) => ({
                          ...prev,
                          [channel.key]: value === true,
                        }))
                      }
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="single-message">Message personnalisé</Label>
              <Textarea
                id="single-message"
                value={singleMessage}
                onChange={(event) => setSingleMessage(event.target.value)}
                placeholder="Rappel: votre loyer de {amount} XOF pour {property_title} est dû le {due_date}."
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser le message par défaut. Variables: {"{tenant_name}"} •{" "}
                {"{amount}"} • {"{property_title}"} • {"{due_date}"} • {"{overdue_days}"}
              </p>
            </div>
            {singleError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {singleError}
              </div>
            ) : null}
            {singleResult ? (
              <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Résultat: {singleResult.sent} envoyées • {singleResult.failed} échouées •{" "}
                {singleResult.skipped} ignorées
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={singleLoading}>
                {singleLoading ? "Envoi en cours..." : "Envoyer la relance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
