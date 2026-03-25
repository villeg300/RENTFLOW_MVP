"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgencyContext } from "@/context/AgencyContext"
import { useFinanceDashboard } from "@/hooks/useFinanceDashboard"
import { fetchFinanceDashboard } from "@/services/finance.service"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value)
}

function formatDateRangeShort(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`
  }
  const startLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(start)
  const endLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end)
  return `${startLabel} – ${endLabel}`
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function SectionCards() {
  const { agencies, activeAgencyId } = useAgencyContext()
  const { data, isLoading, error, refresh } = useFinanceDashboard({
    agencyId: activeAgencyId,
  })
  const [previousOccupancy, setPreviousOccupancy] = useState<number | null>(null)
  const [previousOccupancyLoading, setPreviousOccupancyLoading] = useState(false)

  useEffect(() => {
    if (!activeAgencyId || !data?.period.start_date) {
      setPreviousOccupancy(null)
      return
    }

    const periodStartDate = new Date(data.period.start_date)
    if (Number.isNaN(periodStartDate.getTime())) {
      setPreviousOccupancy(null)
      return
    }

    const previousMonthStart = new Date(
      periodStartDate.getFullYear(),
      periodStartDate.getMonth() - 1,
      1
    )
    const previousMonthEnd = new Date(
      periodStartDate.getFullYear(),
      periodStartDate.getMonth(),
      0
    )

    let isActive = true
    setPreviousOccupancyLoading(true)
    fetchFinanceDashboard({
      agencyId: activeAgencyId,
      startDate: formatDateForApi(previousMonthStart),
      endDate: formatDateForApi(previousMonthEnd),
    })
      .then((previousData) => {
        if (!isActive) return
        setPreviousOccupancy(previousData.occupancy.rate_percent)
      })
      .catch(() => {
        if (!isActive) return
        setPreviousOccupancy(null)
      })
      .finally(() => {
        if (!isActive) return
        setPreviousOccupancyLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [activeAgencyId, data?.period.start_date])

  if (!agencies.length) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Aucune agence</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Créez votre première agence
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-col items-start gap-3 text-sm">
            <div className="text-muted-foreground">
              Le dashboard financier s&apos;affichera dès qu&apos;une agence sera créée.
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
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="@container/card">
            <CardHeader className="gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Dashboard financier</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger les données
            </CardTitle>
            <CardAction>
              <Badge variant="outline">Erreur</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-2 text-sm">
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

  const currency = data.currency || "XOF"
  const monthLabels = [
    "jan",
    "fev",
    "mar",
    "avr",
    "mai",
    "jun",
    "jul",
    "aou",
    "sep",
    "oct",
    "nov",
    "dec",
  ]
  const periodStart = new Date(data.period.start_date)
  const periodEnd = new Date(data.period.end_date)
  const isPeriodValid =
    !Number.isNaN(periodStart.getTime()) && !Number.isNaN(periodEnd.getTime())
  const periodMonthLabel = !isPeriodValid
    ? "Mois"
    : periodStart.getMonth() === periodEnd.getMonth() &&
        periodStart.getFullYear() === periodEnd.getFullYear()
      ? monthLabels[periodStart.getMonth()]
      : `${monthLabels[periodStart.getMonth()]}–${monthLabels[periodEnd.getMonth()]}`
  const customPeriodLabel = !isPeriodValid
    ? "Période perso"
    : `${monthLabels[periodStart.getMonth()]} ${periodStart.getFullYear()}–${monthLabels[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`
  const periodLabel = data.period.is_custom ? customPeriodLabel : periodMonthLabel
  const periodShort = formatDateRangeShort(
    data.period.start_date,
    data.period.end_date
  )
  const occupancyDelta =
    previousOccupancy === null
      ? null
      : data.occupancy.rate_percent - previousOccupancy
  const occupancyTrendClass =
    occupancyDelta === null
      ? "text-muted-foreground"
      : occupancyDelta > 0
        ? "text-emerald-600 dark:text-emerald-300"
        : occupancyDelta < 0
          ? "text-rose-600 dark:text-rose-300"
          : "text-muted-foreground"
  const OccupancyTrendIcon =
    occupancyDelta !== null && occupancyDelta < 0
      ? TrendingDownIcon
      : TrendingUpIcon
  const occupancyDeltaLabel =
    previousOccupancyLoading
      ? "…"
      : occupancyDelta === null
        ? "—"
        : `${occupancyDelta > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(occupancyDelta)}%`

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card" size="sm">
        <CardHeader className="gap-2">
          <CardDescription className="truncate">Revenus du mois</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(data.revenues.current_month, currency)}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="max-w-full rounded-full px-2 py-0.5 text-[11px]"
            >
              <TrendingUpIcon />
              <span className="truncate" title={periodLabel}>
                {periodLabel}
              </span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <div className="line-clamp-1">Période · {periodShort}</div>
          <div>YTD {formatCurrency(data.revenues.year_to_date, currency)}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card" size="sm">
        <CardHeader className="gap-2">
          <CardDescription>Impayés</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(data.overdue.amount, currency)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
              <TrendingDownIcon />
              {formatNumber(data.overdue.leases_count)} baux
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <div>Restant: {formatCurrency(data.rent.outstanding_current_month, currency)}</div>
          <div>Attendu: {formatCurrency(data.rent.expected_current_month, currency)}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card" size="sm">
        <CardHeader className="gap-2">
          <CardDescription>Taux d'occupation</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(data.occupancy.rate_percent)}%
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={`rounded-full px-2 py-0.5 text-[11px] ${occupancyTrendClass}`}
            >
              <OccupancyTrendIcon />
              <span className="truncate" title="Évolution vs mois précédent">
                {occupancyDeltaLabel}
              </span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <div>{formatNumber(data.occupancy.occupied_properties)} biens loués</div>
          <div>{formatNumber(data.occupancy.vacant_properties)} biens disponibles</div>
        </CardFooter>
      </Card>
      <Card className="@container/card" size="sm">
        <CardHeader className="gap-2">
          <CardDescription>Total Biens</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(data.occupancy.total_properties)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
              <TrendingUpIcon />
              {formatNumber(data.leases.active_count)} baux actifs
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <div>{formatNumber(data.occupancy.occupied_properties)} biens loués</div>
          <div>{formatNumber(data.occupancy.vacant_properties)} biens vacants</div>
        </CardFooter>
      </Card>
    </div>
  )
}
