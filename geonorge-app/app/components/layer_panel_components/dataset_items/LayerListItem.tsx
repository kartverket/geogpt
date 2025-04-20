import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ActiveLayerInfo,
  SearchResult,
  WMSLayer,
} from "../../chat_components/types";

interface LayerListItemProps {
  layer: WMSLayer;
  layerInfo: ActiveLayerInfo; // Contains pre-calculated ID and source details
  isChecked: boolean;
  parentSearchResult: SearchResult; // The dataset this layer belongs to
  onToggleLayerRequest: (
    layerInfo: ActiveLayerInfo,
    isChecked: boolean,
    searchResult: SearchResult
  ) => void;
}

const LayerListItem: React.FC<LayerListItemProps> = ({
  layer,
  layerInfo,
  isChecked,
  parentSearchResult,
  onToggleLayerRequest,
}) => {
  return (
    <div
      key={layerInfo.id} // Key is essential here within the map in the parent
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors duration-200 ${
        isChecked
          ? "bg-color-gn-primary/10 border border-color-gn-primary/30"
          : "hover:bg-gray-100"
      }`}
    >
      <Checkbox
        id={layerInfo.id}
        checked={isChecked}
        onCheckedChange={(checkedState) => {
          // Call the handler passed all the way from LayerPanel
          onToggleLayerRequest(layerInfo, !!checkedState, parentSearchResult);
        }}
        className="data-[state=checked]:bg-color-gn-primary"
      />
      <label
        htmlFor={layerInfo.id}
        className="flex-1 text-sm text-gray-700 cursor-pointer"
      >
        {layerInfo.title}{" "}
        {/* Use title from layerInfo which handles fallback */}
      </label>
    </div>
  );
};

export default LayerListItem;
