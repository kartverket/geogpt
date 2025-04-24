import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SearchResult,
  WMSLayer,
  ActiveLayerInfo,
} from "../../chat_components/types";

interface LayerListItemProps {
  layer: WMSLayer;
  layerInfo: ActiveLayerInfo;
  isChecked: boolean;
  parentSearchResult: SearchResult;
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
    <div className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-100">
      <Checkbox
        id={layerInfo.id}
        checked={isChecked}
        onCheckedChange={(checked) => {
          // Boolean or 'indeterminate', we only handle boolean
          if (typeof checked === "boolean") {
            onToggleLayerRequest(layerInfo, checked, parentSearchResult);
          }
        }}
        aria-label={`Toggle layer ${layerInfo.title}`}
        className="mt-0.5 data-[state=checked]:bg-color-gn-primary data-[state=checked]:text-white"
      />
      <label
        htmlFor={layerInfo.id}
        className={`text-sm cursor-pointer break-words ${
          isChecked ? "font-medium text-color-gn-primary" : "text-gray-700"
        }`}
        style={{
          wordBreak: "break-word",
          whiteSpace: "normal",
          hyphens: "auto",
          maxWidth: "calc(100% - 28px)", // Accounting for checkbox width and gap
        }}
      >
        {layer.title || layer.name}
      </label>
    </div>
  );
};

export default LayerListItem;
