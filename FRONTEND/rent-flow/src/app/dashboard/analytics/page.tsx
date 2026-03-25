
"use client"

import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgencyContext } from "@/context/AgencyContext"
import { useFinanceDashboard } from "@/hooks/useFinanceDashboard"

const rentBreakdownConfig = {
  collected: { label: "Encaissé", color: "var(--chart-1)" },
  outstanding: { label: "Restant", color: "var(--chart-4)" },
} satisfies ChartConfig

const occupancyConfig = {
  occupied: { label: "Loués", color: "var(--chart-2)" },
  vacant: { label: "Vacants", color: "var(--chart-5)" },
} satisfies ChartConfig

const rentFlowColors = ["var(--chart-2)", "var(--chart-1)", "var(--chart-4)"]

export default function AnalyticsPage() {
  const { agencies, activeAgencyId } = useAgencyContext()
  const { data, isLoading, error, refresh } = useFinanceDashboard({
    agencyId: activeAgencyId,
  })

  const currency = data?.currency ?? "XOF"
  const currencyFormatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })

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
              Les statistiques d&apos;analyse apparaîtront après création d&apos;une agence.
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
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="@container/card xl:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
          <Card className="@container/card">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="@container/card">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-[240px] w-full" />
            </CardContent>
          </Card>
          <Card className="@container/card">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-[240px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Analytics</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              Impossible de charger les données
            </CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">Erreur</span>
            </CardAction>
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

  const rentBreakdown = [
    { name: "collected", label: "Encaissé", value: data.rent.collected_current_month },
    { name: "outstanding", label: "Restant", value: data.rent.outstanding_current_month },
  ]

  const occupancyBreakdown = [
    { name: "occupied", label: "Loués", value: data.occupancy.occupied_properties },
    { name: "vacant", label: "Vacants", value: data.occupancy.vacant_properties },
  ]

  const rentFlowData = [
    { name: "Attendu", value: data.rent.expected_current_month },
    { name: "Encaissé", value: data.rent.collected_current_month },
    { name: "Restant", value: data.rent.outstanding_current_month },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartAreaInteractive />
        </div>
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Encaissement vs restant</CardTitle>
            <CardDescription>Répartition des loyers du mois</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              config={rentBreakdownConfig}
              className="mx-auto aspect-auto h-[250px] w-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      formatter={(value, name) => {
                        const label =
                          rentBreakdownConfig[name as keyof typeof rentBreakdownConfig]?.label ??
                          name
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {currencyFormatter.format(Number(value))}
                            </span>
                          </div>
                        )
                      }}
                      indicator="dot"
                    />
                  }
                />
                <Pie
                  data={rentBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  strokeWidth={2}
                >
                  {rentBreakdown.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={`var(--color-${entry.name})`}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {rentBreakdown.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: `var(--color-${entry.name})` }}
                />
                <span>{entry.label}</span>
              </div>
            ))}
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Loyers du mois</CardTitle>
            <CardDescription>
              Attendu, encaissé et restant à encaisser
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              config={{ value: { label: "Montant", color: "var(--chart-1)" } }}
              className="aspect-auto h-[240px] w-full"
            >
              <BarChart data={rentFlowData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        currencyFormatter.format(Number(value))
                      }
                    />
                  }
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {rentFlowData.map((entry, index) => (
                    <Cell key={entry.name} fill={rentFlowColors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Occupation des biens</CardTitle>
            <CardDescription>
              {data.occupancy.rate_percent.toFixed(1)}% d&apos;occupation
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              config={occupancyConfig}
              className="aspect-auto h-[240px] w-full"
            >
              <BarChart data={occupancyBreakdown}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        new Intl.NumberFormat("fr-FR").format(Number(value))
                      }
                      indicator="dot"
                    />
                  }
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {occupancyBreakdown.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={`var(--color-${entry.name})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {occupancyBreakdown.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: `var(--color-${entry.name})` }}
                />
                <span>{entry.label}</span>
              </div>
            ))}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
