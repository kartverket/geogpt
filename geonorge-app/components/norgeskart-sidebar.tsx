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
  MessageSquare,
  Library,
  Search,
  Download,
  Eye,
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
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Geonorge from "@/components/output-onlinepngtools.png";

// Catalog data
const catalogItems = [
  { name: "Fields", hasView: true, hasDownload: false },
  { name: "Vbase", hasView: true, hasDownload: false },
  { name: "Dam", hasView: true, hasDownload: false },
  { name: "DTM 50", hasView: false, hasDownload: true },
  { name: "N5 Raster", hasView: false, hasDownload: true },
  { name: "N1000 Raster", hasView: false, hasDownload: true },
  { name: "FKB-AR5", hasView: true, hasDownload: false },
  { name: "Elveg", hasView: false, hasDownload: false },
  { name: "Funn", hasView: false, hasDownload: false },
  { name: "Hovedled og Biled", hasView: true, hasDownload: true },
  { name: "Dybdedata - rådata", hasView: false, hasDownload: false },
  { name: "N250 Raster", hasView: false, hasDownload: true },
  { name: "Måleserie", hasView: true, hasDownload: false },
];

export function NorgeskartSidebar() {
  const [isOpen, setIsOpen] = React.useState(true);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(
    null
  );

  const mapItems = [
    {
      icon: Map,
      label: "BAKGRUNNSKART: Landkart",
      id: "bakgrunn",
      children: [
        { label: "Landkart", badge: undefined },
        { label: "Flybilder", badge: undefined },
        { label: "Rasterkart", badge: undefined },
        { label: "Gråtone", badge: undefined },
        { label: "Enkel", badge: undefined },
        { label: "Terreng", badge: undefined },
        { label: "Sjøkart (WMTS)", badge: undefined },
        { label: "Sjøkart (WMS)", badge: undefined },
        { label: "Jan Mayen", badge: undefined },
        { label: "Svalbard", badge: undefined },
        { label: "Elektronisk sjøkart", badge: undefined },
        { label: "Øk-1.utgave", badge: undefined },
      ],
    },
    {
      icon: Layers,
      label: "TEMAKART",
      id: "tema",
      children: [
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

  if (!isOpen) return null; // Don't render the sidebar when isOpen is false

  return (
    <Sidebar className="border-r w-[400px]">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-36">
          <div>
            <Image src={Geonorge} alt="" className="w-2/3" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mr-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>
      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-1">
          <TabsTrigger value="menu" className="hover:bg-white">
            Meny
          </TabsTrigger>
          <TabsTrigger value="chatbot" className="hover:bg-white">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chatbot
          </TabsTrigger>
          <TabsTrigger value="catalog" className="hover:bg-white">
            <Library className="mr-2 h-4 w-4" />
            Kartkatalog
          </TabsTrigger>
        </TabsList>
        <TabsContent value="menu" className="border-0 p-0 px-2">
          <SidebarContent>
            {/* Map Section */}
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
                        <SidebarMenuItem key={child.label}>
                          <SidebarMenuButton className="justify-between">
                            <div className="flex items-center gap-2">
                              {"icon" in child && (
                                <child.icon className="h-4 w-4" />
                              )}
                              <span>{child.label}</span>
                            </div>
                            {child.badge ? (
                              <span className="rounded-full bg-blue-100 px-2 text-xs">
                                {child.badge}
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            <SidebarSeparator className="my-4" />

            {/* Actions Section */}
            <Collapsible defaultOpen className="">
              <CollapsibleTrigger className="w-full">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="justify-between w-full">
                      <span className="text-sm font-medium">
                        HVA VIL DU GJØRE?
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
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

            {/* Footer Section */}
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
              <SidebarSeparator className="mt-4" />

              <div className="flex gap-4 p-4 text-sm text-black">
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

        <TabsContent value="chatbot" className="border-0 p-4">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Chatbot</h2>
            <p className="text-sm text-muted-foreground">
              Chat med vår AI-assistent for å få hjelp med kartrelaterte
              spørsmål.
            </p>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm">Chatbot-grensesnittet kommer snart...</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="catalog" className="border-0 p-0">
          <div className="flex flex-col">
            <div className="border-b p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Søk etter datasett..." className="pl-8" />
                </div>
                <Button
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Nedlastning Formater
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" className="mt-2 w-full justify-between">
                Filter
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {catalogItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between border-b px-4 py-2 hover:bg-muted/50"
                >
                  <span>{item.name}</span>
                  <div className="flex gap-2">
                    {item.hasView && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {item.hasDownload && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Sidebar>
  );
}
