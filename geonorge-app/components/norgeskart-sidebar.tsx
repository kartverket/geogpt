"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Map,
  Layers,
  Home,
  TreePine,
  MapPin,
  Accessibility,
  Target,
  Plane,
  FileText,
  Building2,
  Pencil,
  Share2,
  Printer,
  Mountain,
  HelpCircle,
  Mail,
  Shield,
  X,
  Menu,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export function NorgeskartSidebar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(
    null
  );
  const [selectedLayers, setSelectedLayers] = React.useState<string[]>([]);

  const mapItems = [
    {
      icon: Map,
      label: "BAKGRUNNSKART: Landkart",
      id: "bakgrunn",
      children: [
        { label: "Landkart" },
        { label: "Flybilder" },
        { label: "Rasterkart" },
        { label: "Gråtone" },
        { label: "Enkel" },
        { label: "Terreng" },
        { label: "Sjøkart (WMTS)" },
        { label: "Sjøkart (WMS)" },
        { label: "Jan Mayen" },
        { label: "Svalbard" },
        { label: "Elektronisk sjøkart" },
        { label: "Øk-1.utgave" },
      ],
    },
    {
      icon: Layers,
      label: "TEMAKART",
      id: "tema",
      children: [
        {
          label: "Kvikkleireskred",
          subLayers: [
            { id: "kvikkleire-kartlagt", label: "KvikkleireKartlagtOmrade" },
            { id: "kvikkleire-risiko", label: "KvikkleireRisiko" },
            { id: "kvikkleire-faregrad", label: "KvikkleireFaregrad" },
          ],
        },
        { icon: Home, label: "Eiendom" },
        { icon: TreePine, label: "Friluftsliv", badge: "0" },
        { icon: MapPin, label: "Stedsnavn" },
        { icon: Accessibility, label: "Tilgjengelighet" },
        { icon: Target, label: "Fastmerker" },
        { icon: Plane, label: "Luftfartshindre" },
        { icon: FileText, label: "Kartbladoversikt" },
        { icon: Building2, label: "Arbeidsgiverargiftssoner" },
      ],
    },
  ];

  const actionItems = [
    { icon: Pencil, label: "TEGNE OG MALE" },
    { icon: Share2, label: "DELE KARTET" },
    { icon: Printer, label: "SKRIV UT" },
    { icon: Mountain, label: "LAG HØYDEPROFIL" },
  ];

  const footerItems = [
    { icon: HelpCircle, label: "Tips og triks" },
    { icon: Mail, label: "Kontakt oss" },
    { icon: Shield, label: "Personvern" },
  ];

  const handleSectionToggle = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const handleLayerToggle = (layerId: string) => {
    setSelectedLayers((prev) => {
      if (prev.includes(layerId)) {
        return prev.filter((id) => id !== layerId);
      }
      return [...prev, layerId];
    });
  };

  return (
    <>
      <Sidebar
        className={`border-r transition-all duration-300 ease-in-out ${
          isOpen ? "w-[400px]" : "w-16"
        }`}
      >
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOpen && <span className="font-medium">Norgeskart</span>}
            </div>
            {isOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarHeader>
        {isOpen && (
          <Tabs defaultValue="menu" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="menu">Meny</TabsTrigger>
            </TabsList>
            <TabsContent value="menu" className="border-0 p-0">
              <SidebarContent>
                <div className="space-y-1">
                  {mapItems.map((item) => (
                    <Collapsible
                      key={item.id}
                      open={expandedSection === item.id}
                      onOpenChange={() => handleSectionToggle(item.id)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <SidebarMenu>
                          <SidebarMenuItem>
                            <SidebarMenuButton className="justify-between w-full">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  {item.label}
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4">
                        <SidebarMenu>
                          {item.children.map((child) => (
                            <React.Fragment key={child.label}>
                              <SidebarMenuItem>
                                <SidebarMenuButton className="justify-between">
                                  <div className="flex items-center gap-2">
                                    {"icon" in child && child.icon && (
                                      <child.icon className="h-4 w-4" />
                                    )}
                                    <span>{child.label}</span>
                                  </div>
                                  {"badge" in child && child.badge ? (
                                    <span className="rounded-full bg-blue-100 px-2 text-xs">
                                      {child.badge}
                                    </span>
                                  ) : "subLayers" in child ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                              {"subLayers" in child && child.subLayers && (
                                <div className="pl-6 pt-2 space-y-2">
                                  {child.subLayers.map((subLayer) => (
                                    <div
                                      key={subLayer.id}
                                      className="flex items-center space-x-2"
                                    >
                                      <Checkbox
                                        id={subLayer.id}
                                        checked={selectedLayers.includes(
                                          subLayer.id
                                        )}
                                        onCheckedChange={() =>
                                          handleLayerToggle(subLayer.id)
                                        }
                                      />
                                      <label
                                        htmlFor={subLayer.id}
                                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        {subLayer.label}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </React.Fragment>
                          ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>

                <SidebarSeparator className="my-4" />

                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full justify-between px-4">
                      <span className="text-sm font-medium">
                        HVA VIL DU GJØRE?
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4">
                    <SidebarMenu>
                      {actionItems.map((item) => (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton className="justify-between">
                            <div className="flex items-center gap-2">
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </div>
                            <ChevronRight className="h-4 w-4" />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>

                <SidebarSeparator className="my-4" />

                <div className="mt-auto">
                  <SidebarMenu>
                    {footerItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton className="justify-between">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>

                  <div className="flex gap-4 p-4 text-sm">
                    <button className="text-muted-foreground hover:underline">
                      Bokmål
                    </button>
                    <button className="text-muted-foreground hover:underline">
                      Nynorsk
                    </button>
                    <button className="text-muted-foreground hover:underline">
                      English
                    </button>
                  </div>
                </div>
              </SidebarContent>
            </TabsContent>
          </Tabs>
        )}
      </Sidebar>
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-3 z-50"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}
    </>
  );
}
