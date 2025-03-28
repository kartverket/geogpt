"use client";

import * as React from "react";
import { useState, useMemo, useRef, useEffect } from "react";

// Logo
import GeoNorgeLogo from "@/components/ui/GeoNorgeLogo";

// Icons
import { PenTool, Share2, LineChart } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { SidebarFooter } from "@/app/components/sidebar_components/SidebarFooter";
import { Temakart } from "@/app/components/sidebar_components/Temakart";
import { ResetTourView } from "@/app/components/sidebar_components/ResetTourView";
import { PrivacyView } from "@/app/components/sidebar_components/PrivacyView";
import { ContactUsView } from "@/app/components/sidebar_components/ContactUsView";

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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  availableLayers?: WMSLayer[];
  trackedDatasets?: TrackedDataset[];
  onLayerChangeWithDataset?: (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => void;
  onRemoveDataset?: (datasetId: string) => void;
  onChangeBaseLayer?: LayerChangeFunctions;
  setSearchMarker: (marker: { lat: number; lng: number } | null) => void;
}

export function AppSidebar({
  availableLayers = [],
  trackedDatasets = [],
  onLayerChangeWithDataset,
  onRemoveDataset,
  onChangeBaseLayer,
  setSearchMarker,
  ...props
}: AppSidebarProps) {
  const { language, setLanguage, t } = useLanguage();
  const [layerSearch, setLayerSearch] = React.useState("");
  const [isLayerSectionVisible, setIsLayerSectionVisible] = useState(true);
  const [isActionSectionVisible, setIsActionSectionVisible] = useState(true);
  const [isAddressSectionVisible, setIsAddressSectionVisible] = useState(true);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("landskart");
  const [isBaseMapSectionVisible, setIsBaseMapSectionVisible] = useState(true);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedDatasets, setExpandedDatasets] = React.useState<
    Record<string, boolean>
  >({});
  const [showResetTourView, setShowResetTourView] = useState(false);
  const [showPrivacyView, setShowPrivacyView] = useState(false);
  const [showContactUsView, setShowContactUsView] = useState(false);

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
        icon: PenTool,
        disabled: true,
        disabledMessage: t("feature_not_available"),
      },
      {
        title: t("share_map"),
        icon: Share2,
        disabled: true,
        disabledMessage: t("feature_not_available"),
      },
      {
        title: t("create_elevation_profile"),
        icon: LineChart,
        disabled: true,
        disabledMessage: t("feature_not_available"),
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

  // Handler to switch to the reset view
  const handleShowResetTour = () => {
    setShowResetTourView(true);
    setShowPrivacyView(false);
    setShowContactUsView(false);
  };

  // Handler for privacy view
  const handleShowPrivacy = () => {
    setShowPrivacyView(true);
    setShowResetTourView(false);
    setShowContactUsView(false);
  };

  // Handler for contact us view
  const handleShowContactUs = () => {
    setShowContactUsView(true);
    setShowResetTourView(false);
    setShowPrivacyView(false);
  };

  return (
    <Sidebar
      variant="inset"
      {...props}
      className={cn(
        "border-r border-gray-200 shadow-lg w-[350px] 2xl:w-[400px] max-w-[90vw] bg-gray-100",
        "data-[state=open]:translate-x-0",
        "data-[state=closed]:-translate-x-full",
        "transition-transform duration-300 ease-in-out",
        "flex flex-col h-full"
      )}
    >
      <SidebarHeader className="p-4 border-b bg-white shadow-sm flex-shrink-0">
        <div className="flex flex-row items-center justify-between">
          <GeoNorgeLogo className="h-auto w-40 mx-auto" />
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4 flex-grow overflow-y-auto">
        {showResetTourView ? (
          <ResetTourView t={t} onBack={() => setShowResetTourView(false)} />
        ) : showPrivacyView ? (
          <PrivacyView t={t} onBack={() => setShowPrivacyView(false)} />
        ) : showContactUsView ? (
          <ContactUsView t={t} onBack={() => setShowContactUsView(false)} />
        ) : (
          <Temakart
            t={t}
            setSearchMarker={setSearchMarker} // Ensure this prop is passed
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
            isAddressSectionVisible={isAddressSectionVisible}
            setIsBaseMapSectionVisible={setIsBaseMapSectionVisible}
            setIsLayerSectionVisible={setIsLayerSectionVisible}
            setIsActionSectionVisible={setIsActionSectionVisible}
            setIsAddressSectionVisible={setIsAddressSectionVisible}
            data={data}
          />
        )}
      </SidebarContent>
      <SidebarFooter
        language={language}
        handleLanguageChange={handleLanguageChange}
        t={t}
        onShowResetTour={handleShowResetTour}
        onShowPrivacy={handleShowPrivacy}
        onShowContactUs={handleShowContactUs}
      />
    </Sidebar>
  );
}
