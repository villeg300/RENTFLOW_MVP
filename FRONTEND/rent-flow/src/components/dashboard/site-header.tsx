"use client"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAgencyContext } from "@/context/AgencyContext"

export function SiteHeader() {
  const pathname = usePathname()
  const pagename = pathname.split("/").pop()
  const router = useRouter()
  const { agencies, activeAgencyId, setActiveAgencyId, isLoading } = useAgencyContext()

  const hasAgencies = agencies.length > 0
  const canShowSelect = hasAgencies && !isLoading

  const handleAgencyChange = (value: string) => {
    if (value === "__create__") {
      router.push("/dashboard/agences")
      return
    }
    setActiveAgencyId(value)
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-8"
        />
        <h1 className="text-base font-medium">{pagename}</h1>
        <div className="ml-auto flex items-center gap-2">
          {canShowSelect ? (
            <Select
              value={activeAgencyId ?? ""}
              onValueChange={handleAgencyChange}
            >
              <SelectTrigger
                className="min-w-0 w-36 sm:w-44 md:w-52 max-w-[60vw]"
                aria-label="Sélectionner une agence"
              >
                <SelectValue placeholder="Sélectionner une agence" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>Vos agences</SelectLabel>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.agency_id} value={agency.agency_id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectItem value="__create__" className="text-primary font-medium">
                  Créer une agence
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Button
              type="button"
              onClick={() => router.push("/dashboard/agences")}
              disabled={isLoading}
            >
              Créer une agence
            </Button>
          )}
        </div>
        
      </div>
    </header>
  )
}
