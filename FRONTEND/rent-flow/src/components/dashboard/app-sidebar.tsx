"use client"

import * as React from "react"

import { NavDocuments } from "@/components/dashboard/nav-documents"
import { NavMain } from "@/components/dashboard/nav-main"
import { NavSecondary } from "@/components/dashboard/nav-secondary"
import { NavUser } from "@/components/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"



import { 
  LayoutDashboardIcon, 
  ListIcon, 
  ChartBarIcon, 
  FolderIcon, 
  UsersIcon, 
  CameraIcon, 
  FileTextIcon, 
  Settings2Icon, 
  CircleHelpIcon, 
  SearchIcon, 
  DatabaseIcon, 
  FileChartColumnIcon, 
  ReceiptText,
  FileIcon, 
  CommandIcon, 
  Building,
  CreditCard,
  Wallet,
  Bell,
  
} from "lucide-react"


const data = {
  // user: {
  //   name: user.full,
  //   email: "m@example.com",
  //   avatar: "/avatars/shadcn.jpg",
  // },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: (
        <ChartBarIcon
        />
      ),
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: (
        <Bell
        />
      ),
    },
    {
      title: "Agences",
      url: "/dashboard/agences",
      icon: (
        <Building
        />
      ),
    },
    {
      title: "Locataires",
      url: "/dashboard/locataires",
      icon: (
        <UsersIcon
        />
      ),
    },
    {
      title: "Paiements",
      url: "/dashboard/paiements",
      icon: (
        <Wallet
        />
      ),
    },
    
  ],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <CameraIcon
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Parametres",
      url: "/settings",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Aide",
      url: "/help",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
    // {
    //   title: "Recherche",
    //   url: "#",
    //   icon: (
    //     <SearchIcon
    //     />
    //   ),
    // },
  ],
  documents: [
     {
      name: "Contrats",
      url: "/dashboard/contrats",
      icon: (
        <FileIcon
        />
      ),
    },
    {
      name: "Quittances",
      url: "/dashboard/quittances",
      icon: (
        <ReceiptText
        />
      ),
    },
    {
      name: "Reports",
      url: "/dashboard/reports",
      icon: (
        <FileChartColumnIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">RentFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
