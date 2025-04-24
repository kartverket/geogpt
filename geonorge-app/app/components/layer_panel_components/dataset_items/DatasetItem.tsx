import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronRight,
  ChevronDown,
  Download,
  Loader2,
  MapIcon,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  SearchResult,
  WMSLayer,
  ActiveLayerInfo,
} from "../../chat_components/types";
import LayerListItem from "./LayerListItem";

// Add a descriptionsCache to store fetched descriptions
const descriptionsCache = new Map<string, string>();

interface DatasetItemProps {
  searchResult: SearchResult;
  activeLayerIds: string[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (uuid: string) => void;
  onSelectDataset: (dataset: SearchResult) => void;
  onDownloadDataset: (dataset: SearchResult) => void;
  onToggleLayerRequest: (
    layerInfo: ActiveLayerInfo,
    isChecked: boolean,
    searchResult: SearchResult
  ) => void;
}

const DatasetItem: React.FC<DatasetItemProps> = (props) => {
  const {
    searchResult,
    activeLayerIds,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelectDataset,
    onDownloadDataset,
    onToggleLayerRequest,
  } = props;

  // Add state for hover card open state and description loading
  const [isHoverCardOpen, setIsHoverCardOpen] = useState(false);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);

  if (!searchResult.uuid) {
    console.warn("DatasetItem rendered without UUID", searchResult);
    return null;
  }

  const resultKey = searchResult.uuid!;
  const canDownload = !!searchResult.downloadUrl;
  const hasActiveLayer = activeLayerIds.some((id) =>
    id.startsWith(resultKey + "-")
  );
  const availableLayers = searchResult.wmsUrl?.available_layers ?? [];
  const sourceUrl = searchResult.wmsUrl?.wms_url;

  // Function to fetch dataset description
  const fetchDatasetDescription = async (uuid: string) => {
    if (descriptionsCache.has(uuid)) return;

    setIsLoadingDescription(true);
    try {
      const response = await fetch(
        `https://kartkatalog.geonorge.no/api/metadata/${uuid}`
      );
      const data = await response.json();

      const extractedAbstract =
        data.Abstract ||
        data.abstract ||
        data.metadata?.abstract ||
        data.purpose ||
        "Ingen beskrivelse tilgjengelig";

      descriptionsCache.set(uuid, extractedAbstract);
    } catch (error) {
      console.error("Error fetching dataset description:", error);
      descriptionsCache.set(uuid, "Kunne ikke laste beskrivelse");
    } finally {
      setIsLoadingDescription(false);
    }
  };

  // Handle hover card open to trigger description fetching
  const handleHoverCardOpenChange = (open: boolean) => {
    setIsHoverCardOpen(open);
    if (open && !descriptionsCache.has(resultKey)) {
      fetchDatasetDescription(resultKey);
    }
  };

  // Function to handle "Vis på kart" button click
  const handleShowOnMap = () => {
    // Only proceed if we have available layers
    if (availableLayers.length > 0 && sourceUrl) {
      // Get the first layer in the dataset
      const firstLayer = availableLayers[0];

      // Construct the layer info for the first layer
      const layerInfo: ActiveLayerInfo = {
        id: `${resultKey}-${firstLayer.name}`,
        name: firstLayer.name,
        title: firstLayer.title || firstLayer.name,
        sourceUrl: sourceUrl,
        sourceTitle: searchResult.title || "Ukjent Kilde",
        sourceUuid: resultKey,
      };

      // Toggle on the layer and expand the dataset
      onToggleLayerRequest(layerInfo, true, searchResult);
      if (!isExpanded) {
        onToggleExpand(resultKey);
      }
    }
  };

  return (
    <div
      className={`${
        canDownload || availableLayers.length > 0 ? "pt-3 pb-1" : "pt-3 pb-2"
      } flex items-start gap-3 bg-white hover:bg-gray-50 transition-colors border-b-2 border-grey duration-200 rounded-lg shadow-sm ${
        hasActiveLayer
          ? "bg-color-gn-primarylight/10 border border-color-gn-primary/50"
          : "border border-gray-200"
      } relative mt-2`}
    >
      {/* Download Checkbox - Now absolutely positioned */}
      <div className="absolute top-[11px] left-2">
        {canDownload ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-5 w-5 flex items-center justify-center">
                <Checkbox
                  id={`select-${resultKey}`}
                  checked={isSelected}
                  onCheckedChange={() => onSelectDataset(searchResult)}
                  aria-label={`Select dataset ${
                    searchResult.title || "Ukjent Tittel"
                  }`}
                  className="data-[state=checked]:bg-color-gn-primary transition-none"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-gray-800 shadow-lg rounded-md">
              <p>Marker for nedlastning</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="h-5 w-5" /> /* Placeholder with fixed height/width */
        )}
      </div>

      {availableLayers.length > 0 && (
        <div
          className="absolute top-[11px] right-2 h-5 w-5 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          onClick={() => onToggleExpand(resultKey)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-color-gn-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-color-gn-primary" />
          )}
        </div>
      )}

      {/* Dataset Info & Layers - Adjusted with fixed left padding */}
      <div className="flex-1 pl-10 pr-10">
        {/* Title Area */}
        <div className="flex flex-col mb-2">
          {/* Title with HoverCard */}
          <div className="mb-1.5 -ml-1">
            <HoverCard
              openDelay={100}
              closeDelay={0}
              open={isHoverCardOpen}
              onOpenChange={handleHoverCardOpenChange}
            >
              <HoverCardTrigger asChild>
                <a
                  href={`https://kartkatalog.geonorge.no/metadata/${encodeURIComponent(
                    searchResult.title || "Dataset"
                  )}/${resultKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium transition-colors duration-200 underline-offset-4 hover:underline block"
                >
                  <span
                    className={`${
                      hasActiveLayer
                        ? "text-color-gn-primary"
                        : "text-gray-800 hover:text-color-gn-lightblue"
                    } line-clamp-2`}
                  >
                    {searchResult.title || "Ukjent Tittel"}
                  </span>
                </a>
              </HoverCardTrigger>
              <HoverCardContent
                side="left"
                className="w-80 p-4 rounded-omar border border-gray-200 shadow-lg"
              >
                <div className="space-y-2">
                  <h4 className="font-medium text-color-gn-primary">
                    {searchResult.title || "Ukjent Tittel"}
                  </h4>
                  {!descriptionsCache.has(resultKey) || isLoadingDescription ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-color-gn-secondary" />
                      <span>Laster beskrivelse...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 line-clamp-6">
                      {descriptionsCache.get(resultKey)}
                    </p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>

          {/* Actions & Info Row */}
          <div className="flex items-center">
            {/* Layer badge and actions */}
            <div className="flex items-center gap-3 flex-1 -ml-1 flex-nowrap">
              {/* Show different badge text based on layer count */}
              <Badge
                variant={availableLayers.length > 0 ? "outline" : "secondary"}
                className={`shrink-0 border-gray-300 ${
                  availableLayers.length > 0
                    ? "text-gray-700 bg-gray-50"
                    : "text-gray-500 bg-gray-100"
                }`}
              >
                {availableLayers.length > 0
                  ? `${availableLayers.length} lag`
                  : "Ingen tilgjengelig lag"}
              </Badge>

              {/* Add Vis på kart button - only show if there are available layers */}
              {availableLayers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-gray-600 hover:text-color-gn-primary border-gray-200 transition-colors duration-200 whitespace-nowrap"
                  onClick={handleShowOnMap}
                >
                  Vis på kart
                </Button>
              )}

              {canDownload && onDownloadDataset && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-gray-600 hover:text-color-gn-primary border-gray-200 transition-colors duration-200 whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadDataset(searchResult);
                  }}
                >
                  <Download size={14} className="mr-1" />
                  Last ned
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* WMS Layer List (Collapsible) */}
        {isExpanded && searchResult.wmsUrl?.available_layers && (
          <div className="mt-2 mb-2">
            {availableLayers.length > 0 ? (
              <div className="pl-2">
                <div className="max-h-60 overflow-y-auto custom-thin-scrollbar pr-2">
                  <div className="space-y-1">
                    {availableLayers.map((layer: WMSLayer) => {
                      if (!sourceUrl || !resultKey) {
                        console.warn(
                          "Skipping layer render due to missing sourceUrl or resultKey",
                          layer,
                          searchResult
                        );
                        return null;
                      }

                      const uniqueLayerId = `${resultKey}-${layer.name}`;
                      const isChecked = activeLayerIds.includes(uniqueLayerId);

                      // Construct LayerInfo for the callback and LayerListItem prop
                      const layerInfo: ActiveLayerInfo = {
                        id: uniqueLayerId,
                        name: layer.name,
                        title: layer.title || layer.name,
                        sourceUrl: sourceUrl,
                        sourceTitle: searchResult.title || "Ukjent Kilde",
                        sourceUuid: resultKey,
                      };

                      // Use the new LayerListItem component
                      return (
                        <LayerListItem
                          key={uniqueLayerId}
                          layer={layer}
                          layerInfo={layerInfo}
                          isChecked={isChecked}
                          parentSearchResult={searchResult}
                          onToggleLayerRequest={onToggleLayerRequest}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 text-xs text-gray-500 italic">
                Ingen kartlag funnet for denne WMS-tjenesten.
              </div>
            )}
          </div>
        )}

        {/* Define custom thin scrollbar style */}
        <style jsx global>{`
          .custom-thin-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: auto;
          }

          .custom-thin-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }

          .custom-thin-scrollbar::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
          }

          .custom-thin-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }

          /* Firefox */
          .custom-thin-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #d1d5db transparent;
          }
        `}</style>
      </div>
    </div>
  );
};

export default DatasetItem;
