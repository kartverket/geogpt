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
  Eye,
  AlertCircle,
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
import { Skeleton } from "@/components/ui/skeleton";

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

const LayerSkeletonLoader = () => (
  <div className="space-y-2 py-2 pl-4">
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
      <Skeleton className="h-4 w-3/4 bg-gray-200" />
    </div>
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
      <Skeleton className="h-4 w-1/2 bg-gray-200" />
    </div>
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
      <Skeleton className="h-4 w-5/6 bg-gray-200" />
    </div>
  </div>
);

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
  const wmsInfo = searchResult.wmsUrl;
  const isLoadingWms = wmsInfo && "loading" in wmsInfo && wmsInfo.loading;
  const hasWmsError = wmsInfo && "error" in wmsInfo;
  const availableLayers =
    (wmsInfo && "available_layers" in wmsInfo
      ? wmsInfo.available_layers
      : []) ?? [];
  const sourceUrl =
    wmsInfo && "wms_url" in wmsInfo ? wmsInfo.wms_url : undefined;
  const hasAnyWmsData = wmsInfo !== null && wmsInfo !== undefined;

  const hasActiveLayer = activeLayerIds.some((id) =>
    id.startsWith(resultKey + "-")
  );

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
    // Only proceed if we have successfully loaded available layers
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

  // Conditional rendering for the layer list section
  const renderLayerListContent = () => {
    if (isLoadingWms) {
      return <LayerSkeletonLoader />;
    }
    // TODO: Add error handling ONE DAY
    // if (hasWmsError) {
    //   return <div>Feil ved lasting av kartlag</div>;
    // }

    // Check if loading finished successfully AND has layers
    if (
      wmsInfo &&
      "available_layers" in wmsInfo &&
      wmsInfo.available_layers.length > 0 &&
      sourceUrl
    ) {
      return (
        <div className="pl-2">
          <ScrollArea className="max-h-60 overflow-y-auto custom-thin-scrollbar pr-2">
            <div className="space-y-1">
              {wmsInfo.available_layers.map((layer) => {
                const layerInfoForThisItem: ActiveLayerInfo = {
                  id: `${resultKey}-${layer.name}`,
                  name: layer.name,
                  title: layer.title || layer.name,
                  sourceUrl: sourceUrl,
                  sourceTitle: searchResult.title || "Ukjent Kilde",
                  sourceUuid: resultKey,
                };
                const isChecked = activeLayerIds.includes(
                  layerInfoForThisItem.id
                );
                return (
                  <LayerListItem
                    key={layerInfoForThisItem.id}
                    layer={layer}
                    layerInfo={layerInfoForThisItem}
                    isChecked={isChecked}
                    parentSearchResult={searchResult}
                    onToggleLayerRequest={onToggleLayerRequest}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </div>
      );
    }

    // If loading finished (not loading, not error) but no layers were found OR wmsInfo became null after loading
    if (!isLoadingWms && hasAnyWmsData) {
      // hasAnyWmsData means it was loading or had a URL initially
      return (
        <div className="px-2 py-1.5 text-xs text-gray-500 italic">
          Ingen kartlag funnet for denne tjenesten.
        </div>
      );
    }

    return null; // Default case (no WMS info at all initially)
  };

  return (
    <div
      className={`${
        canDownload ||
        (wmsInfo &&
          "available_layers" in wmsInfo &&
          wmsInfo.available_layers.length > 0)
          ? "pt-3 pb-1"
          : "pt-3 pb-2"
      } flex items-start gap-3 bg-white hover:bg-gray-50 transition-colors border-b-2 border-grey duration-200 rounded-lg shadow-sm ${
        hasActiveLayer
          ? "bg-color-gn-primarylight/10 border border-color-gn-primary/50"
          : "border border-gray-200"
      } relative mt-2`}
    >
      {/* Checkbox & Expand Toggle (Absolutely Positioned) */}
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
          <div className="h-5 w-5" />
        )}
      </div>
      {/* Expand Toggle */}
      {wmsInfo &&
        "available_layers" in wmsInfo &&
        wmsInfo.available_layers.length > 0 && (
          <div
            className="absolute top-[11px] right-2 h-5 w-5 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            onClick={() => onToggleExpand(resultKey)}
            aria-label={isExpanded ? "Skjul kartlag" : "Vis kartlag"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-color-gn-primary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-color-gn-primary" />
            )}
          </div>
        )}

      {/* Dataset Info & Layers */}
      <div className="flex-1 pl-10 pr-10">
        {/* Title Area */}
        <div className="flex flex-col mb-2">
          <div className="mb-1.5 -ml-1">
            {/* Title with HoverCard */}
            <HoverCard
              openDelay={100}
              closeDelay={0}
              open={isHoverCardOpen}
              onOpenChange={handleHoverCardOpenChange}
            >
              <span
                className={`${
                  hasActiveLayer
                    ? "text-color-gn-primary"
                    : "text-gray-800 hover:text-color-gn-lightblue"
                } line-clamp-2 text-sm`}
              >
                <HoverCardTrigger asChild>
                  <a
                    href={`https://kartkatalog.geonorge.no/metadata/${encodeURIComponent(
                      searchResult.title || "Dataset"
                    )}/${resultKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="underline-offset-4 hover:underline"
                  >
                    {searchResult.title || "Ukjent Tittel"}
                  </a>
                </HoverCardTrigger>
              </span>
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
            <div className="flex items-center gap-3 flex-1 -ml-1 flex-nowrap">
              {/* Layer Badge */}
              <Badge
                variant={
                  hasAnyWmsData &&
                  !isLoadingWms &&
                  !hasWmsError &&
                  availableLayers.length > 0
                    ? "outline"
                    : "secondary"
                }
                className={`shrink-0 border-gray-300 ${
                  // Style based on specific state
                  isLoadingWms
                    ? "text-blue-600 bg-blue-50 border-blue-200"
                    : hasWmsError
                    ? "text-red-600 bg-red-50 border-red-200"
                    : hasAnyWmsData && availableLayers.length > 0
                    ? "text-gray-700 bg-gray-50"
                    : "text-gray-500 bg-gray-100" //
                }`}
                title={
                  // More descriptive title
                  isLoadingWms
                    ? "Laster kartlag..."
                    : hasWmsError
                    ? "Feil ved lasting av kartlag"
                    : hasAnyWmsData && availableLayers.length > 0
                    ? "Inneholder kartlag"
                    : "Ingen kartlag tilgjengelig"
                }
              >
                {/* Icon based on state */}
                {isLoadingWms ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : hasWmsError ? (
                  <AlertCircle size={12} className="mr-1" />
                ) : (
                  <MapIcon size={12} className="mr-1" />
                )}
                {/* Text based on state */}
                {isLoadingWms
                  ? "Laster..."
                  : hasWmsError
                  ? "Feil"
                  : hasAnyWmsData && availableLayers.length > 0
                  ? `${availableLayers.length} lag`
                  : "Ingen tilgjengelig lag"}
              </Badge>

              {/* Show on Map Button - Condition depends on successful load */}
              {wmsInfo &&
                "available_layers" in wmsInfo &&
                wmsInfo.available_layers.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs text-color-kv-primary hover:text-color-gn-primary border-gray-200 transition-colors duration-200 whitespace-nowrap"
                    onClick={handleShowOnMap}
                    title="Vis første kartlag på kartet"
                  >
                    <Eye size={14} />
                    Vis på kart
                  </Button>
                )}

              {canDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-black hover:text-color-gn-primary border-gray-200 transition-colors duration-200 whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadDataset(searchResult);
                  }}
                >
                  <Download size={14} />
                  Last ned
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* WMS Layer List (Collapsible) */}
        {isExpanded && hasAnyWmsData && (
          <div className="mt-2 mb-2">{renderLayerListContent()}</div>
        )}
      </div>

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
  );
};

export default DatasetItem;
