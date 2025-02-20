"use client";

import * as React from "react";
import {
  Map,
  PenTool,
  Share2,
  LineChart,
  HelpCircle,
  Layers2,
  Mail,
  Shield,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import Image from "next/image";
import Icon from "../public/geonorge-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface WMSLayer {
  name: string;
  title: string;
}

const data = {
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

export function AppSidebar({
  selectedLayer,
  setSelectedLayer,
  availableLayers = [],
  onLayerChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  selectedLayer: string;
  setSelectedLayer: (layerName: string) => void;
  availableLayers?: WMSLayer[];
  onLayerChange?: (layerName: string) => void;
}) {

  const handleLayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLayer(e.target.value);
    onLayerChange?.(e.target.value);
  };

  const cn = (...classes: string[]) => {
    return classes.filter(Boolean).join(' ');
  };

  return (
    <Sidebar 
      variant="inset" 
      {...props} 
      className={cn( // Cn takes in class based on state.
        "border shadow-lg w-[350px] max-w-[90vw]",
        "data-[state=open]:translate-x-0",
        "data-[state=closed]:-translate-x-full"
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center space-x-2">
                  <Image src={Icon} alt="Geonorge Logo" className="w-7 mb-1" />
                  <h1 className="font-semibold text-3xl">GEONORGE</h1>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>

        <div className="px-4 py-2">
        <div className="flex items-center space-x-2">
            <Layers2 className="mb-2"/>
              <label htmlFor="layer-select" className="block mb-2">
                Bakgrunnskart
              </label>
          </div>
          <div className="flex items-center space-x-2">
            <Map className="mb-2 text-[#FE642F]"/>
              <label htmlFor="layer-select" className="block mb-2">
                Temakart
              </label>
          </div>
          <select
            id="layer-select"
            value={selectedLayer}
            onChange={handleLayerChange}
            className="w-full p-2 border rounded"
          >
            {availableLayers.map((layer) => (
              <option key={layer.name} value={layer.name}>
                {layer.title}
              </option>
            ))}
          </select>
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