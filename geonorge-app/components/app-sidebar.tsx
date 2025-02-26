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
  Search,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import Image from "next/image";
import Icon from "../public/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Checkbox } from "./ui/checkbox";
import { useState } from "react";

interface WMSLayer {
  name: string;
  title: string;
}

interface LayerChangeFunctions {
  revertToBaseMap: () => void;
  changeToGraattKart: () => void;
  changeToRasterKart: () => void;
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
  selectedLayers,
  onLayerChange,
  availableLayers = [],
  onChangeBaseLayer,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  selectedLayers: string[];
  onLayerChange: (layerName: string, isChecked: boolean) => void;
  availableLayers?: WMSLayer[];
  onChangeBaseLayer?: LayerChangeFunctions;
}) {
  const [layerSearch, setLayerSearch] = React.useState("");

  // Filter layers based on search input
  const filteredLayers = availableLayers.filter((layer) =>
    layer.title.toLowerCase().includes(layerSearch.toLowerCase())
  );

  const cn = (...classes: string[]) => {
    return classes.filter(Boolean).join(" ");
  };

  const [isLayerSectionVisible, setIsLayerSectionVisible] = useState(true);

  return (
    <Sidebar
      variant="inset"
      {...props}
      className={cn(
        // Cn takes in class based on state.
        "border shadow-lg w-[350px] max-w-[90vw]",
        "data-[state=open]:translate-x-0",
        "data-[state=closed]:-translate-x-full"
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center space-x-2 mb-3">
              <Image src={Icon} alt="Geonorge Logo" className="w-7 mb-1" />
              <h1 className="font-semibold text-3xl">GEONORGE</h1>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-4 py-2 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 ml-2">
              <Map className="h-6 w-6 mb-2"/>
              <label htmlFor="base-layer-select" className="font-medium">
                Bakgrunnskart
              </label>
            </div>
            {onChangeBaseLayer && (
              <div className="relative">
                <select
                  id="base-layer-select"
                  onChange={(e) => {
                    switch (e.target.value) {
                      case "landskart":
                        onChangeBaseLayer.revertToBaseMap();
                        break;
                      case "graatone":
                        onChangeBaseLayer.changeToGraattKart();
                        break;
                      case "rasterkart":
                        onChangeBaseLayer.changeToRasterKart();
                        break;
                    }
                  }}
                  className="w-full p-2 pr-8 border rounded bg-white text-sm
                    cursor-pointer hover:bg-gray-100 transition-colors appearance-none"
                >
                  <option value="landskart" className="py-2">Landskart</option>
                  <option value="graatone" className="py-2">Gråtone</option>
                  <option value="rasterkart" className="py-2">Rasterkart</option>
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <svg 
                    className="h-4 w-4 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
        </div>

          <div className="space-y-2">
            <div 
              className="flex items-center space-x-2 cursor-pointer select-none hover:bg-gray-100 rounded p-2" 
              onClick={() => setIsLayerSectionVisible(!isLayerSectionVisible)}
            >
              <Layers2 className="h-6 w-6 text-[#FE642F]" />
              <label className="font-medium flex-1">Temakart</label>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${
                  isLayerSectionVisible ? 'rotate-0' : '-rotate-90'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
          </div>

            {/* Add search input */}
            {isLayerSectionVisible && (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Søk i etter lag..."
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
                className="w-full pl-8 p-2 border rounded text-sm"
              />
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto rounded p-2">
              {filteredLayers.map((layer) => (
                <div key={layer.name} className="flex items-center space-x-1 hover:bg-gray-100 h-8">
                  <Checkbox
                      checked={selectedLayers.includes(layer.name)}
                      id={layer.name}
                      onCheckedChange={(checked) => {
                        onLayerChange(layer.name, checked as boolean);
                      }}
                      className="w-5 h-5 rounded-[2px]"
                    />
                  <label htmlFor={layer.name} className="text-md">
                    {layer.title}
                  </label>
                </div>
              ))}
        {filteredLayers.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">
            Ingen lag funnet
          </p>
        )}
      </div>
    </>
  )}
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

