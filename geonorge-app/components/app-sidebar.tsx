"use client";

import * as React from "react";
import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";

// Logo
import GeoNorgeLogo from "@/app/components/GeoNorgeLogo";

// Icons
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
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Wrench,
} from "lucide-react";

// UI Components
import { Checkbox } from "./ui/checkbox";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

// Translation
import { Language } from "@/i18n/translations";
import { useLanguage } from "@/i18n/LanguageContext";

interface WMSLayer {
  name: string;
  title: string;
}

interface LayerChangeFunctions {
  revertToBaseMap: () => void;
  changeToGraattKart: () => void;
  changeToRasterKart: () => void;
}

interface TrackedDataset {
  id: string;
  title: string;
  wmsUrl: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
}

export function AppSidebar({
  availableLayers = [],
  trackedDatasets = [],
  onLayerChangeWithDataset,
  onRemoveDataset,
  onChangeBaseLayer,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  availableLayers?: WMSLayer[];
  trackedDatasets?: TrackedDataset[];
  onLayerChangeWithDataset?: (datasetId: string, layerName: string, isChecked: boolean) => void;
  onRemoveDataset?: (datasetId: string) => void;
  onChangeBaseLayer?: LayerChangeFunctions;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [layerSearch, setLayerSearch] = React.useState("");
  const [isLayerSectionVisible, setIsLayerSectionVisible] = useState(true);
  const [isActionSectionVisible, setIsActionSectionVisible] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>("layers");
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("landskart");
  const [isBaseMapSectionVisible, setIsBaseMapSectionVisible] = useState(true);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedDatasets, setExpandedDatasets] = React.useState<Record<string, boolean>>({});

  // Add refs to track scroll positions
  const datasetScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const datasetScrollPositionRef = useRef<Record<string, number>>({});
  const mainScrollPositionRef = useRef<number>(0); // New ref for main container scroll

  // Save scroll position before toggling dataset expansion
  const handleToggleDatasetExpansion = (datasetId: string) => {
    // Save the main container scroll position
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current = datasetScrollContainerRef.current.scrollTop;
    }

    // If dataset is expanded, save its scroll position before collapsing
    if (expandedDatasets[datasetId] && datasetScrollContainerRef.current) {
      const datasetElement = datasetScrollContainerRef.current.querySelector(
        `[data-dataset-id="${datasetId}"]`
      );
      
      if (datasetElement) {
        const scrollContainer = datasetElement.querySelector('.dataset-layer-container') as HTMLElement;
        if (scrollContainer) {
          datasetScrollPositionRef.current[datasetId] = scrollContainer.scrollTop;
        }
      }
    }
    
    // Toggle the dataset expansion
    setExpandedDatasets(prev => ({
      ...prev,
      [datasetId]: !prev[datasetId]
    }));
  };

  // Filter layers based on search
  const filteredLayers = useMemo(() => 
    availableLayers.filter((layer) =>
      layer.title.toLowerCase().includes(layerSearch.toLowerCase())
    ),
    [availableLayers, layerSearch]
  );
  
  // Filter datasets based on search
  const filteredDatasets = useMemo(() => 
    trackedDatasets
      .map(dataset => ({
        ...dataset,
        availableLayers: dataset.availableLayers.filter(layer =>
          layer.title.toLowerCase().includes(layerSearch.toLowerCase())
        ),
      }))
      .filter(dataset => dataset.availableLayers.length > 0),
    [trackedDatasets, layerSearch]
  );

  const cn = (...classes: string[]) => {
    return classes.filter(Boolean).join(" ");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const data = {
    actions: [
      {
        title: t("draw_and_measure"),
        url: "#",
        icon: PenTool,
      },
      {
        title: t("share_map"),
        url: "#",
        icon: Share2,
      },
      {
        title: t("create_elevation_profile"),
        url: "#",
        icon: LineChart,
      },
    ],
    footer: [
      {
        title: t("tips_and_tricks"),
        url: "#",
        icon: HelpCircle,
      },
      {
        title: t("contact_us"),
        url: "#",
        icon: Mail,
      },
      {
        title: t("privacy"),
        url: "#",
        icon: Shield,
      },
    ],
  };

  const Section = ({
    id,
    title,
    icon,
    children,
    collapsible = false,
    isOpen = true,
    onToggle = () => {},
  }: {
    id?: string;
    title: string;
    icon?: React.ElementType;
    children: React.ReactNode;
    collapsible?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
  }) => {
    const Icon = icon;
    const isActive = id === activeSection;

    return (
      <div
        className={cn(
          "mb-4 bg-white rounded-lg border transition-all duration-200 overflow-hidden",
          isActive ? "" : "border-gray-100 shadow-sm hover:border-gray-200"
        )}
        onClick={id ? () => setActiveSection(id) : undefined}
      >
        <div
          className={cn(
            "flex items-center gap-3 p-3 transition-colors",
            collapsible ? "cursor-pointer hover:bg-gray-50" : ""
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (collapsible) onToggle();
          }}
        >
          {Icon && (
            <div className="rounded-md p-1.5 flex items-center justify-center transition-colors bg-color-gn-primary/5">
              <Icon className="h-5 w-5 text-color-gn-primary" />
            </div>
          )}
          <h3
            className={cn(
              "font-medium flex-1",
              collapsible && isOpen ? "text-color-gn-primary" : "text-gray-800"
            )}
          >
            {title}
          </h3>
          {collapsible && (
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen ? "text-color-gn-primary" : "text-gray-500",
                !isOpen ? "-rotate-90" : ""
              )}
            />
          )}
        </div>
        {(!collapsible || isOpen) && <div className="p-3">{children}</div>}
      </div>
    );
  };

  const ActionItem = ({
    icon: Icon,
    title,
    url,
  }: {
    icon: React.ElementType;
    title: string;
    url: string;
  }) => (
    <a
      href={url}
      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-gray-50 transition-colors"
    >
      <div className="bg-color-gn-primary/10 rounded-md p-1.5 flex items-center justify-center">
        <Icon className="h-4 w-4 text-color-gn-primary" />
      </div>
      <span className="text-sm font-medium text-gray-700 truncate">
        {title}
      </span>
    </a>
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setLayerSearch(e.target.value);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  React.useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [layerSearch]);

  // Deselect all layers across all datasets
  const deselectAllLayersGlobally = () => {
    if (!onLayerChangeWithDataset) return;
    trackedDatasets.forEach(dataset => {
      dataset.selectedLayers.forEach(layerName => {
        onLayerChangeWithDataset(dataset.id, layerName, false);
      });
    });
  };
  
  // Check if any layers are selected in any dataset
  const hasSelectedLayers = trackedDatasets.some(dataset => dataset.selectedLayers.length > 0);

  // Handle checkbox change with scroll position preservation
  const handleLayerChange = (datasetId: string, layerName: string, checked: boolean) => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current = datasetScrollContainerRef.current.scrollTop;
    }
    
    // Store current scroll position for the specific dataset container
    if (datasetScrollContainerRef.current) {
      const datasetElement = datasetScrollContainerRef.current.querySelector(
        `[data-dataset-id="${datasetId}"]`
      );
      if (datasetElement) {
        const scrollContainer = datasetElement.querySelector('.dataset-layer-container') as HTMLElement;
        if (scrollContainer) {
          datasetScrollPositionRef.current[datasetId] = scrollContainer.scrollTop;
        }
      }
    }
    if (onLayerChangeWithDataset) {
      onLayerChangeWithDataset(datasetId, layerName, checked);
    }
  };

  // Restore scroll positions after render
  useEffect(() => {
    if (datasetScrollContainerRef.current) {
      // First restore the main container scroll position
      datasetScrollContainerRef.current.scrollTop = mainScrollPositionRef.current;
      
      // Then restore individual dataset scroll positions
      Object.keys(expandedDatasets).forEach(datasetId => {
        if (expandedDatasets[datasetId] && datasetScrollPositionRef.current[datasetId] !== undefined) {
          const datasetElement = datasetScrollContainerRef.current?.querySelector(
            `[data-dataset-id="${datasetId}"]`
          );
          if (datasetElement) {
            const scrollContainer = datasetElement.querySelector('.dataset-layer-container') as HTMLElement;
            if (scrollContainer) {
              scrollContainer.scrollTop = datasetScrollPositionRef.current[datasetId];
            }
          }
        }
      });
    }
  }, [trackedDatasets, expandedDatasets]); 

  // Also save main scroll position when removing datasets
  const handleRemoveDataset = (datasetId: string) => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current = datasetScrollContainerRef.current.scrollTop;
    }
    if (onRemoveDataset) {
      onRemoveDataset(datasetId);
    }
  };

  // Also save main scroll position when deselecting all layers
  const handleDeselectAllLayers = () => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current = datasetScrollContainerRef.current.scrollTop;
    }
    deselectAllLayersGlobally();
  };

  return (
    <Sidebar
      variant="inset"
      {...props}
      className={cn(
        "border-r border-gray-200 shadow-lg w-[350px] max-w-[90vw] bg-gray-50",
        "data-[state=open]:translate-x-0",
        "data-[state=closed]:-translate-x-full",
        "transition-transform duration-300 ease-in-out",
        "flex flex-col h-full"
      )}
    >
      <SidebarHeader className="p-4 border-b bg-white shadow-sm flex-shrink-0">
        <GeoNorgeLogo className="h-auto w-40 mx-auto" />
      </SidebarHeader>
      <SidebarContent className="p-4 flex-grow overflow-y-auto">
        <div className="space-y-4">
          <Section
            id="basemap"
            collapsible={true}
            title={t("background_map")}
            icon={Map}
            isOpen={isBaseMapSectionVisible}
            onToggle={() =>
              setIsBaseMapSectionVisible(!isBaseMapSectionVisible)
            }
          >
            {onChangeBaseLayer && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={cn(
                    "flex flex-col items-center p-2 rounded-md border transition-colors",
                    selectedBaseMap === "landskart"
                      ? "border-color-gn-primary bg-color-gn-primary/5 ring-1 ring-color-gn-primary/30"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                  onClick={() => {
                    setSelectedBaseMap("landskart");
                    onChangeBaseLayer.revertToBaseMap();
                  }}
                >
                  <div className="w-full h-16 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    <Image
                      src="https://norgeskart.no/assets/img/land.png"
                      alt="Raster map preview"
                      className="w-full h-full object-cover"
                      width={100}
                      height={64}
                      unoptimized
                    />
                  </div>
                  <span className="text-xs font-medium text-center">
                    {t("landscape_map")}
                  </span>
                </button>
                <button
                  className={cn(
                    "flex flex-col items-center p-2 rounded-md border transition-colors",
                    selectedBaseMap === "graatone"
                      ? "border-color-gn-primary bg-color-gn-primary/5 ring-1 ring-color-gn-primary/30"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                  onClick={() => {
                    setSelectedBaseMap("graatone");
                    onChangeBaseLayer.changeToGraattKart();
                  }}
                >
                  <div className="w-full h-16 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    <Image
                      src="https://norgeskart.no/assets/img/grey.png"
                      alt="Raster map preview"
                      className="w-full h-full object-cover"
                      width={100}
                      height={64}
                      unoptimized
                    />
                  </div>
                  <span className="text-xs font-medium text-center">
                    {t("grayscale_map")}
                  </span>
                </button>
                <button
                  className={cn(
                    "flex flex-col items-center p-2 rounded-md border transition-colors",
                    selectedBaseMap === "rasterkart"
                      ? "border-color-gn-primary bg-color-gn-primary/5 ring-1 ring-color-gn-primary/30"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                  onClick={() => {
                    setSelectedBaseMap("rasterkart");
                    onChangeBaseLayer.changeToRasterKart();
                  }}
                >
                  <div className="w-full h-16 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    <Image
                      src="https://norgeskart.no/assets/img/raster.png"
                      alt="Raster map preview"
                      className="w-full h-full object-cover"
                      width={100}
                      height={64}
                      unoptimized
                    />
                  </div>
                  <span className="text-xs font-medium text-center">
                    {t("raster_map")}
                  </span>
                </button>
              </div>
            )}
          </Section>
          <Section
            id="layers"
            title={t("theme_maps")}
            icon={Layers2}
            collapsible={true}
            isOpen={isLayerSectionVisible}
            onToggle={() => setIsLayerSectionVisible(!isLayerSectionVisible)}
          >
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t("search_layers")}
                  value={layerSearch}
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full pl-10 p-2.5 border border-gray-100 rounded-md text-sm 
                    focus:outline-none focus:ring-1 focus:ring-color-gn-secondary/10 bg-white"
                  style={{ zIndex: 10 }}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>

              {/* Add tracked datasets section */}
              {trackedDatasets.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm text-gray-700">{t("active_datasets")}</span>
                    {hasSelectedLayers && (
                      <button 
                        onClick={handleDeselectAllLayers}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{t("deselect_all")}</span>
                      </button>
                    )}
                  </div>
                  
                  <div 
                    className="space-y-2 max-h-[30vh] overflow-y-auto" 
                    ref={datasetScrollContainerRef}
                    id="datasets-scroll-container"
                  >
                    {filteredDatasets.map((dataset) => (
                      <div 
                        key={dataset.id} 
                        className="border border-gray-200 rounded-md bg-white overflow-hidden"
                        data-dataset-id={dataset.id}
                      >
                        <div 
                          className="flex items-center justify-between p-2.5 bg-gray-50 cursor-pointer border-b border-gray-100"
                          onClick={() => handleToggleDatasetExpansion(dataset.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="bg-color-gn-primary/10 rounded-md p-1.5 flex items-center justify-center">
                              <Layers2 className="h-3.5 w-3.5 text-color-gn-primary" />
                            </div>
                            <span className="font-medium text-sm">{dataset.title}</span>
                            <span className="text-xs bg-color-gn-primary/10 text-color-gn-primary px-1.5 py-0.5 rounded">
                              {dataset.selectedLayers.length}/{dataset.availableLayers.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {onRemoveDataset && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveDataset(dataset.id);
                                }}
                                className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-colors"
                                title={t("remove_dataset")}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            {expandedDatasets[dataset.id] ? 
                              <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            }
                          </div>
                        </div>
                        
                        {expandedDatasets[dataset.id] && (
                          <div 
                            className="max-h-[20vh] overflow-y-auto dataset-layer-container"
                          >
                            {dataset.availableLayers.map((layer) => (
                              <div 
                                key={`${dataset.id}-${layer.name}`}
                                className="flex items-center gap-2.5 p-2.5 hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-t-0"
                              >
                                <Checkbox
                                  checked={dataset.selectedLayers.includes(layer.name)}
                                  id={`${dataset.id}-${layer.name}`}
                                  onCheckedChange={(checked) => {
                                    handleLayerChange(dataset.id, layer.name, checked as boolean);
                                  }}
                                  className="h-4 w-4 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor={`${dataset.id}-${layer.name}`}
                                  className="text-sm cursor-pointer flex-1 truncate text-gray-700"
                                >
                                  {layer.title}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Show a message when no layers or datasets match the search */}
              {filteredLayers.length === 0 && filteredDatasets.length === 0 && layerSearch.trim() !== "" && (
                <div className="p-4 text-center border border-gray-200 bg-white rounded-md">
                  <p className="text-sm text-gray-500">
                    {t("no_layers_found")}
                  </p>
                </div>
              )}
            </div>
          </Section>
          <Section
            id="actions"
            title={t("tool")}
            icon={Wrench}
            collapsible={true}
            isOpen={isActionSectionVisible}
            onToggle={() => setIsActionSectionVisible(!isActionSectionVisible)}
          >
            <div className="space-y-1">
              {data.actions.map((action, index) => (
                <ActionItem
                  key={index}
                  icon={action.icon}
                  title={action.title}
                  url={action.url}
                />
              ))}
            </div>
          </Section>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t bg-white flex-shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <div className="p-3">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {data.footer.map((item, index) => (
              <a
                key={index}
                href={item.url}
                className="flex flex-col items-center p-2 rounded-md hover:bg-gray-50 transition-colors gap-1"
                title={item.title}
              >
                <div className="bg-color-gn-primary/10 rounded-full p-1.5">
                  <item.icon className="h-4 w-4 text-color-gn-primary" />
                </div>
                <span className="text-xs text-gray-600 text-center truncate w-full">
                  {item.title}
                </span>
              </a>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                className={cn(
                  "px-2 py-1 rounded-md transition-colors",
                  language === "nb"
                    ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                onClick={() => handleLanguageChange("nb")}
              >
                Bokmål
              </button>
              <button
                className={cn(
                  "px-2 py-1 rounded-md transition-colors",
                  language === "nn"
                    ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                onClick={() => handleLanguageChange("nn")}
              >
                Nynorsk
              </button>
              <button
                className={cn(
                  "px-2 py-1 rounded-md transition-colors",
                  language === "en"
                    ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                onClick={() => handleLanguageChange("en")}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
