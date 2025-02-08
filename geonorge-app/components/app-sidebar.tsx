"use client";

import * as React from "react";
import {
  Map,
  Layers,
  PenTool,
  Share2,
  LineChart,
  HelpCircle,
  Mail,
  Shield,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "BAKGRUNNSKART",
      url: "#",
      icon: Map,
      items: [
        {
          title: "Landkart",
          url: "#",
        },
      ],
    },
    {
      title: "TEMAKART",
      url: "#",
      icon: Layers,
      items: [],
    },
  ],
  quickClaySlides: [
    {
      title: "KvikkleireKartlagtOmrade",
      checked: false,
    },
    {
      title: "KvikkleireRisiko",
      checked: false,
    },
    {
      title: "KvikkleireFaregrad",
      checked: false,
    },
  ],
  actions: [
    {
      title: "TEGNE OG MÅLE",
      url: "#",
      icon: PenTool,
    },
    {
      title: "DELE KARTET",
      url: "#",
      icon: Share2,
    },
    {
      title: "LAG HØYDEPROFIL",
      url: "#",
      icon: LineChart,
    },
  ],
  footer: [
    {
      title: "Tips og triks",
      url: "#",
      icon: HelpCircle,
    },
    {
      title: "Kontakt oss",
      url: "#",
      icon: Mail,
    },
    {
      title: "Personvern",
      url: "#",
      icon: Shield,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [quickClaySlides, setQuickClaySlides] = React.useState(
    data.quickClaySlides
  );

  const handleCheckboxChange = (index: number) => {
    setQuickClaySlides((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <h1 className="font-semibold text-lg">GEONORGE - GeoGPT</h1>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />

        <div className="px-4 py-2">
          <h3 className="mb-2 text-sm font-medium">Kvikkleireskred</h3>
          {quickClaySlides.map((item, index) => (
            <div key={index} className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id={item.title}
                checked={item.checked}
                onChange={() => handleCheckboxChange(index)}
              />
              <label htmlFor={item.title} className="text-sm">
                {item.title}
              </label>
            </div>
          ))}
        </div>

        <div className="px-4 py-2">
          <h3 className="mb-2 text-sm font-medium">HVA VIL DU GJØRE?</h3>
          {data.actions.map((action, index) => (
            <a
              key={index}
              href={action.url}
              className="flex items-center space-x-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <action.icon className="h-4 w-4" />
              <span className="text-sm">{action.title}</span>
            </a>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-4">
          <nav className="space-y-1">
            {data.footer.map((item, index) => (
              <a
                key={index}
                href={item.url}
                className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </a>
            ))}
          </nav>
          <div className="px-3 py-2">
            <div className="flex space-x-2 text-sm">
              <span className="font-medium">Bokmål</span>
              <span>|</span>
              <a href="#" className="hover:underline">
                Nynorsk
              </a>
              <span>|</span>
              <a href="#" className="hover:underline">
                English
              </a>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
