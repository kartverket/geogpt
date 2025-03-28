import * as React from "react";
import { ChevronDown, ChevronUp, Layers2, X } from "lucide-react";
import { Checkbox } from ".././ui/checkbox";
import { TranslationKey } from "@/i18n/translations";

interface WMSLayer {
  name: string;
  title: string;
}

interface TrackedDataset {
  id: string;
  title: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
}

interface DatasetListProps {
  trackedDatasets: TrackedDataset[];
  expandedDatasets: Record<string, boolean>;
  datasetScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  datasetScrollPositionRef: React.MutableRefObject<Record<string, number>>;
  mainScrollPositionRef: React.MutableRefObject<number>;
  onLayerChangeWithDataset?: (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => void;
  onRemoveDataset?: (datasetId: string) => void;
  setExpandedDatasets: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  t: (key: TranslationKey) => string;
  highlightSearchTerm?: string;
}

export const DatasetList: React.FC<DatasetListProps> = ({
  trackedDatasets,
  expandedDatasets,
  datasetScrollContainerRef,
  datasetScrollPositionRef,
  mainScrollPositionRef,
  onLayerChangeWithDataset,
  onRemoveDataset,
  setExpandedDatasets,
  t,
  highlightSearchTerm = "",
}) => {
  // Håndterer utvidelse av dataset-liste med scroll-preservasjon
  const handleToggleDatasetExpansion = (datasetId: string) => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current =
        datasetScrollContainerRef.current.scrollTop;
    }

    if (expandedDatasets[datasetId] && datasetScrollContainerRef.current) {
      const datasetElement = datasetScrollContainerRef.current.querySelector(
        `[data-dataset-id="${datasetId}"]`
      );
      if (datasetElement) {
        const scrollContainer = datasetElement.querySelector(
          ".dataset-layer-container"
        ) as HTMLElement;
        if (scrollContainer) {
          datasetScrollPositionRef.current[datasetId] =
            scrollContainer.scrollTop;
        }
      }
    }

    setExpandedDatasets((prev) => ({
      ...prev,
      [datasetId]: !prev[datasetId],
    }));
  };

  const handleLayerChange = (
    datasetId: string,
    layerName: string,
    checked: boolean
  ) => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current =
        datasetScrollContainerRef.current.scrollTop;
    }

    if (datasetScrollContainerRef.current) {
      const datasetElement = datasetScrollContainerRef.current.querySelector(
        `[data-dataset-id="${datasetId}"]`
      );
      if (datasetElement) {
        const scrollContainer = datasetElement.querySelector(
          ".dataset-layer-container"
        ) as HTMLElement;
        if (scrollContainer) {
          datasetScrollPositionRef.current[datasetId] =
            scrollContainer.scrollTop;
        }
      }
    }

    if (onLayerChangeWithDataset) {
      onLayerChangeWithDataset(datasetId, layerName, checked);
    }
  };

  const handleRemoveDataset = (datasetId: string) => {
    if (datasetScrollContainerRef.current) {
      mainScrollPositionRef.current =
        datasetScrollContainerRef.current.scrollTop;
    }
    if (onRemoveDataset) {
      onRemoveDataset(datasetId);
    }
  };

  // Function to highlight text based on search term
  const highlightText = (text: string): React.ReactNode => {
    if (!highlightSearchTerm || highlightSearchTerm.trim() === "") {
      return text;
    }

    const parts = text.split(new RegExp(`(${highlightSearchTerm})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlightSearchTerm.toLowerCase() ? (
            <mark key={i} className="bg-gray-200 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div
      className="space-y-2 max-h-[30vh] overflow-y-auto"
      ref={datasetScrollContainerRef}
    >
      {trackedDatasets.map((dataset) => (
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
              {expandedDatasets[dataset.id] ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>

          {expandedDatasets[dataset.id] && (
            <div className="max-h-[20vh] overflow-y-auto dataset-layer-container">
              {dataset.availableLayers.map((layer) => (
                <div
                  key={`${dataset.id}-${layer.name}`}
                  className="flex items-center gap-2.5 p-2.5 hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-t-0"
                >
                  <Checkbox
                    checked={dataset.selectedLayers.includes(layer.name)}
                    id={`${dataset.id}-${layer.name}`}
                    onCheckedChange={(checked) =>
                      handleLayerChange(
                        dataset.id,
                        layer.name,
                        checked as boolean
                      )
                    }
                    className="h-4 w-4 border-gray-300 rounded"
                  />
                  <label
                    htmlFor={`${dataset.id}-${layer.name}`}
                    className="text-sm cursor-pointer flex-1 truncate text-gray-700"
                  >
                    {highlightText(layer.title)}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
