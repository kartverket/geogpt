import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import {
  SearchResult,
  WMSLayer,
  ActiveLayerInfo,
} from "../../chat_components/types";
import LayerListItem from "./LayerListItem";
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

const DatasetItem: React.FC<DatasetItemProps> = ({
  searchResult,
  activeLayerIds,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelectDataset,
  onDownloadDataset,
  onToggleLayerRequest,
}) => {
  if (!searchResult.uuid) {
    // Should not happen due to checks in LayerPanel, but good safeguard
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

  return (
    <div
      className={`last:border-b-0 py-3 flex items-start gap-3 bg-white hover:bg-gray-50 transition-colors duration-200 rounded-lg shadow-sm ${
        hasActiveLayer
          ? "bg-color-gn-primarylight/10 border-l-4 border-color-gn-primary/50" // Apply active style consistently
          : "border-b border-gray-200" // Keep bottom border for non-active items for separation
      }`}
    >
      {/* Download Checkbox */}
      <div className="pt-1 pl-2">
        {canDownload ? (
          <Checkbox
            id={`select-${resultKey}`}
            checked={isSelected}
            onCheckedChange={() => onSelectDataset(searchResult)}
            aria-label={`Select dataset ${
              searchResult.title || "Ukjent Tittel"
            }`}
            className="data-[state=checked]:bg-color-gn-primary"
          />
        ) : (
          <div className="w-4 h-4" /> /* Placeholder */
        )}
      </div>

      {/* Dataset Info & Layers */}
      <div className="flex-1 pr-2">
        {/* Title Row */}
        <div
          className="flex items-center justify-between cursor-pointer group mb-1"
          onClick={() => onToggleExpand(resultKey)}
        >
          <div className="flex items-center gap-2 overflow-hidden max-w-[250px]">
            <span className="text-sm font-medium text-gray-800 truncate group-hover:text-color-gn-primary transition-colors duration-200">
              {searchResult.title || "Ukjent Tittel"}
            </span>
            {availableLayers.length > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 border-gray-300 text-gray-700 bg-gray-50"
              >
                {availableLayers.length} lag
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canDownload && onDownloadDataset && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-color-gn-primary transition-colors duration-200"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent toggleExpand
                      onDownloadDataset(searchResult);
                    }}
                  >
                    <Download size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-white text-gray-800 shadow-lg rounded-md">
                  <p>Last ned</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Expand/Collapse Icon */}
            <div className="text-gray-500 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200">
              {isExpanded ? (
                <ChevronDown size={16} className="text-color-gn-primary" />
              ) : (
                <ChevronRight size={16} className="text-color-gn-primary" />
              )}
            </div>
          </div>
        </div>

        {/* WMS Layer List (Collapsible) */}
        {isExpanded && searchResult.wmsUrl?.available_layers && (
          <div className="space-y-1 mt-1 mb-2 animate-slide-up max-h-60 overflow-y-auto pr-1">
            {availableLayers.length > 0 ? (
              availableLayers.map((layer: WMSLayer) => {
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
                    key={uniqueLayerId} // Key remains here for the list
                    layer={layer}
                    layerInfo={layerInfo}
                    isChecked={isChecked}
                    parentSearchResult={searchResult} // Pass the parent dataset info
                    onToggleLayerRequest={onToggleLayerRequest} // Pass the handler down
                  />
                );
              })
            ) : (
              <div className="px-2 py-1.5 text-xs text-gray-500 italic">
                Ingen kartlag funnet for denne WMS-tjenesten.
              </div>
            )}
          </div>
        )}
        {/* Message if WMS details are not available */}
        {isExpanded && !searchResult.wmsUrl?.available_layers && (
          <div className="ml-4 pl-2 border-l border-gray-200 mt-1 mb-2 px-2 py-1.5 text-xs text-gray-500 italic">
            WMS detaljer (kartlag) ikke tilgjengelig.
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetItem;
