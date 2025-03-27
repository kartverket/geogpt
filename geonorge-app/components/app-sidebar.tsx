"use client";

import * as React from "react";
import { useState, useMemo, useRef, useEffect } from "react";

// Logo
import GeoNorgeLogo from "@/app/components/GeoNorgeLogo";

// Icons
import { PenTool, Share2, LineChart } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

import { SidebarFooter } from "@/components/sidebar_components/SidebarFooter";
import { Temakart } from "@/components/sidebar_components/Temakart";

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
  changeToSjoKart: () => void;
}

interface TrackedDataset {
  id: string;
  title: string;
  wmsUrl: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
  titleMatch?: boolean;
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
  onLayerChangeWithDataset?: (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => void;
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
  const [expandedDatasets, setExpandedDatasets] = React.useState<
    Record<string, boolean>
  >({});

  // Add refs to track scroll positions
  const datasetScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const datasetScrollPositionRef = useRef<Record<string, number>>({});
  const mainScrollPositionRef = useRef<number>(0);

  // Filter layers based on search
  const filteredLayers = useMemo(
    () =>
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
      .map((dataset) => {
        // Check if dataset title matches
        const datasetTitleMatch = dataset.title
          .toLowerCase()
          .includes(searchTerm);

        // Filter layers that match search term
        const filteredLayers = dataset.availableLayers.filter((layer) =>
          layer.title.toLowerCase().includes(searchTerm)
        );

        // Include dataset if its title matches OR it has matching layers
        if (datasetTitleMatch || filteredLayers.length > 0) {
          return {
            ...dataset,
            titleMatch: datasetTitleMatch,
            availableLayers: datasetTitleMatch
              ? dataset.availableLayers
              : filteredLayers,
          };
        }
        return null;
      })
      .filter(
        (dataset): dataset is NonNullable<typeof dataset> => dataset !== null
      );
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
  };

  React.useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [layerSearch]);

  // Deselect all layers across all datasets
  const deselectAllLayersGlobally = () => {
    if (!onLayerChangeWithDataset) return;
    trackedDatasets.forEach((dataset) => {
      dataset.selectedLayers.forEach((layerName) => {
        onLayerChangeWithDataset(dataset.id, layerName, false);
      });
    });
  };

  // Check if any layers are selected in any dataset
  const hasSelectedLayers = trackedDatasets.some(
    (dataset) => dataset.selectedLayers.length > 0
  );

  // Restore scroll positions after render
  useEffect(() => {
    if (datasetScrollContainerRef.current) {
      // Restore the main container scroll position
      datasetScrollContainerRef.current.scrollTop =
        mainScrollPositionRef.current;

      // Restore individual dataset scroll positions
      Object.keys(expandedDatasets).forEach((datasetId) => {
        if (
          expandedDatasets[datasetId] &&
          datasetScrollPositionRef.current[datasetId] !== undefined
        ) {
          const datasetElement =
            datasetScrollContainerRef.current?.querySelector(
              `[data-dataset-id="${datasetId}"]`
            );
          if (datasetElement) {
            const scrollContainer = datasetElement.querySelector(
              ".dataset-layer-container"
            ) as HTMLElement;
            if (scrollContainer) {
              scrollContainer.scrollTop =
                datasetScrollPositionRef.current[datasetId];
            }
          }
        }
      });
    }
  }, [trackedDatasets, expandedDatasets]);

  // Save main scroll position when deselecting all layers
  const handleDeselectAllLayers = () => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current =
        datasetScrollContainerRef.current.scrollTop;
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
        <Temakart
          t={t}
          layerSearch={layerSearch}
          setLayerSearch={setLayerSearch}
          filteredLayers={filteredLayers}
          filteredDatasets={filteredDatasets}
          trackedDatasets={trackedDatasets}
          expandedDatasets={expandedDatasets}
          setExpandedDatasets={setExpandedDatasets}
          datasetScrollContainerRef={datasetScrollContainerRef}
          datasetScrollPositionRef={datasetScrollPositionRef}
          mainScrollPositionRef={mainScrollPositionRef}
          hasSelectedLayers={hasSelectedLayers}
          handleDeselectAllLayers={handleDeselectAllLayers}
          onLayerChangeWithDataset={onLayerChangeWithDataset}
          onRemoveDataset={onRemoveDataset}
          onChangeBaseLayer={onChangeBaseLayer}
          selectedBaseMap={selectedBaseMap}
          setSelectedBaseMap={setSelectedBaseMap}
          isBaseMapSectionVisible={isBaseMapSectionVisible}
          isLayerSectionVisible={isLayerSectionVisible}
          isActionSectionVisible={isActionSectionVisible}
          setIsBaseMapSectionVisible={setIsBaseMapSectionVisible}
          setIsLayerSectionVisible={setIsLayerSectionVisible}
          setIsActionSectionVisible={setIsActionSectionVisible}
          data={data}
        />
      </SidebarContent>
      <SidebarFooter
        language={language}
        handleLanguageChange={handleLanguageChange}
        t={t}
      />
    </Sidebar>
  );
}
