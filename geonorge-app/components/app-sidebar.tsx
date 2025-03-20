"use client";

import * as React from "react";
import { useState, useMemo, useRef, useEffect } from "react";

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

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

import { Section } from "@/components/sidebar_components/Section";
import { ActionItem } from "@/components/sidebar_components/ActionItem";
import { BaseMapSelector } from "@/components/sidebar_components/BaseMapSelector";
import { DatasetList } from "@/components/sidebar_components/DatasetList";
import { SidebarFooter } from "@/components/sidebar_components/SidebarFooter";
import { SearchInput } from "@/components/sidebar_components/SearchInput";
import { DeselectAllButton } from "@/components/sidebar_components/DeselectAllButton";

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
  titleMatch?: boolean; // Added for search highlighting
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
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("landskart");
  const [isBaseMapSectionVisible, setIsBaseMapSectionVisible] = useState(true);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedDatasets, setExpandedDatasets] = React.useState<Record<string, boolean>>({});

  // Add refs to track scroll positions
  const datasetScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const datasetScrollPositionRef = useRef<Record<string, number>>({});
  const mainScrollPositionRef = useRef<number>(0);

  // Filter layers based on search
  const filteredLayers = useMemo(() => 
    availableLayers.filter((layer) =>
      layer.title.toLowerCase().includes(layerSearch.toLowerCase())
    ),
    [availableLayers, layerSearch]
  );

  // Filter datasets based on search 
  const filteredDatasets = useMemo(() => {
    if (!layerSearch.trim()) return trackedDatasets;

    const searchTerm = layerSearch.toLowerCase().trim();
    
    return trackedDatasets
      .map(dataset => {
        const filteredLayers = dataset.availableLayers.filter(layer =>
          layer.title.toLowerCase().includes(searchTerm)
        );
        
        return {
          ...dataset,
          titleMatch: false,
          availableLayers: filteredLayers,
        };
      })
      .filter(dataset => dataset.availableLayers.length > 0);
  }, [trackedDatasets, layerSearch]);


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

  // Restore scroll positions after render
  useEffect(() => {
    if (datasetScrollContainerRef.current) {
      // Restore the main container scroll position
      datasetScrollContainerRef.current.scrollTop = mainScrollPositionRef.current;
      
      // Restore individual dataset scroll positions
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

  // Save main scroll position when deselecting all layers
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
            <BaseMapSelector
                selectedBaseMap={selectedBaseMap}
                onChangeBaseLayer={onChangeBaseLayer!}
                t={t}
                setSelectedBaseMap={setSelectedBaseMap}
            />
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
              <SearchInput layerSearch={layerSearch} setLayerSearch={setLayerSearch} t={t} />

              {/* Add tracked datasets section */}
              {trackedDatasets.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm text-gray-700">{t("active_datasets")}</span>
                    <DeselectAllButton hasSelectedLayers={hasSelectedLayers} handleDeselectAllLayers={handleDeselectAllLayers} t={t} />
                  </div>
                  <DatasetList
                      trackedDatasets={trackedDatasets}
                      expandedDatasets={expandedDatasets}
                      datasetScrollContainerRef={datasetScrollContainerRef}
                      datasetScrollPositionRef={datasetScrollPositionRef}
                      mainScrollPositionRef={mainScrollPositionRef}
                      onLayerChangeWithDataset={onLayerChangeWithDataset}
                      onRemoveDataset={onRemoveDataset}
                      setExpandedDatasets={setExpandedDatasets}
                      t={t}
                  />
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
      <SidebarFooter language={language} handleLanguageChange={handleLanguageChange} t={t} />
    </Sidebar>
  );
}