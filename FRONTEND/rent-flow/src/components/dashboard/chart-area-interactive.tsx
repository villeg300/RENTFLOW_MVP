"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useAgencyContext } from "@/context/AgencyContext"
import { useFinanceDashboard } from "@/hooks/useFinanceDashboard"
import { fetchFinanceDashboard } from "@/services/finance.service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Apercu des revenus locatifs"

const metricOptions = [
  { value: "overdue_amount", label: "Impayés mensuels", format: "currency" },
  { value: "occupancy_rate", label: "Taux d'occupation", format: "percent" },
  { value: "active_leases", label: "Baux actifs", format: "count" },
  { value: "overdue_leases", label: "Paiements en retard", format: "count" },
] as const

type MetricOption = (typeof metricOptions)[number]

function formatDateForApi(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const { activeAgencyId } = useAgencyContext()
  const { data, isLoading } = useFinanceDashboard({ agencyId: activeAgencyId })
  const [timeRange, setTimeRange] = React.useState("3m")
  const [secondaryMetric, setSecondaryMetric] = React.useState<MetricOption["value"]>(
    "overdue_amount"
  )
  const [secondarySeries, setSecondarySeries] = React.useState<number[]>([])
  const [secondaryLoading, setSecondaryLoading] = React.useState(false)
  const secondaryCacheRef = React.useRef<Map<string, number[]>>(new Map())

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3m")
    }
  }, [isMobile])

  const months = React.useMemo(() => data?.revenues.last_6_months ?? [], [data])

  const selectedMetric =
    metricOptions.find((option) => option.value === secondaryMetric) ??
    metricOptions[0]

  const chartConfig: ChartConfig = React.useMemo(
    () => ({
      collected: {
        label: "Encaissements",
        color: "var(--chart-1)",
      },
      secondary: {
        label: selectedMetric.label,
        color: "var(--chart-3)",
      },
    }),
    [selectedMetric.label]
  )

  React.useEffect(() => {
    if (!activeAgencyId || months.length === 0) {
      setSecondarySeries([])
      return
    }

    const monthsKey = months.map((item) => item.month).join("|")
    const cacheKey = `${activeAgencyId}:${secondaryMetric}:${monthsKey}`
    const cached = secondaryCacheRef.current.get(cacheKey)
    if (cached) {
      setSecondarySeries(cached)
      setSecondaryLoading(false)
      return
    }

    let isActive = true
    setSecondaryLoading(true)

    const requests = months.map((item) => {
      const [yearStr, monthStr] = item.month.split("-")
      const year = Number(yearStr)
      const monthIndex = Number(monthStr) - 1
      const start = new Date(year, monthIndex, 1)
      const end = new Date(year, monthIndex + 1, 0)
      return fetchFinanceDashboard({
        agencyId: activeAgencyId,
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      })
    })

    Promise.all(requests)
      .then((results) => {
        if (!isActive) return
        const values = results.map((dashboard) => {
          switch (secondaryMetric) {
            case "overdue_amount":
              return dashboard.overdue.amount
            case "occupancy_rate":
              return dashboard.occupancy.rate_percent
            case "active_leases":
              return dashboard.leases.active_count
            case "overdue_leases":
              return dashboard.overdue.leases_count
            default:
              return 0
          }
        })
        secondaryCacheRef.current.set(cacheKey, values)
        setSecondarySeries(values)
      })
      .catch(() => {
        if (!isActive) return
        setSecondarySeries([])
      })
      .finally(() => {
        if (!isActive) return
        setSecondaryLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [activeAgencyId, months, secondaryMetric])

  const chartData = React.useMemo(() => {
    return months.map((item, index) => ({
      date: `${item.month}-01`,
      collected: item.revenue,
      secondary: secondarySeries[index] ?? null,
    }))
  }, [months, secondarySeries])

  const filteredData = React.useMemo(() => {
    const rangeSize = timeRange === "6m" ? 6 : timeRange === "3m" ? 3 : 1
    if (chartData.length <= rangeSize) {
      return chartData
    }
    return chartData.slice(-rangeSize)
  }, [chartData, timeRange])

  const currency = data?.currency ?? "XOF"
  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency]
  )

  const secondaryFormatter = React.useMemo(() => {
    if (selectedMetric.format === "currency") {
      return (value: number) => currencyFormatter.format(value)
    }
    if (selectedMetric.format === "percent") {
      return (value: number) =>
        `${new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value)}%`
    }
    return (value: number) =>
      new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
  }, [currencyFormatter, selectedMetric.format])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Revenus locatifs</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Encaissements mensuels sur la période
          </span>
          <span className="@[540px]/card:hidden">Encaissements mensuels</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Courbes: Encaissements + {selectedMetric.label}
          </span>
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-2">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="6m">6 mois</ToggleGroupItem>
            <ToggleGroupItem value="3m">3 mois</ToggleGroupItem>
            <ToggleGroupItem value="1m">1 mois</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Sélectionner une période"
            >
              <SelectValue placeholder="3 mois" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="6m" className="rounded-lg">
                6 mois
              </SelectItem>
              <SelectItem value="3m" className="rounded-lg">
                3 mois
              </SelectItem>
              <SelectItem value="1m" className="rounded-lg">
                1 mois
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={secondaryMetric}
            onValueChange={(value) =>
              setSecondaryMetric(value as MetricOption["value"])
            }
          >
            <SelectTrigger
              className="flex w-44 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              aria-label="Sélectionner la deuxième courbe"
            >
              <SelectValue placeholder="Deuxième courbe" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {metricOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="rounded-lg">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="flex h-[250px] w-full items-center justify-center text-sm text-muted-foreground">
            Chargement des données…
          </div>
        ) : filteredData.length ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-collected)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-collected)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillSecondary" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-secondary)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-secondary)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("fr-FR", {
                    month: "short",
                  })
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })
                    }
                    formatter={(value, name) => {
                      const numeric = Number(value)
                      const label =
                        chartConfig[name as keyof typeof chartConfig]?.label ?? name
                      const formatted =
                        name === "secondary"
                          ? secondaryFormatter(numeric)
                          : currencyFormatter.format(numeric)
                      return (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {formatted}
                          </span>
                        </div>
                      )
                    }}
                    indicator="dot"
                  />
                }
              />
              {secondaryLoading ? null : (
                <Area
                  dataKey="secondary"
                  type="natural"
                  fill="url(#fillSecondary)"
                  stroke="var(--color-secondary)"
                  stackId="a"
                />
              )}
              <Area
                dataKey="collected"
                type="natural"
                fill="url(#fillCollected)"
                stroke="var(--color-collected)"
                stackId="a"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] w-full items-center justify-center text-sm text-muted-foreground">
            Aucune donnée disponible.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
