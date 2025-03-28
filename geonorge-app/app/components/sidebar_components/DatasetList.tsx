import * as React from "react";
import { useEffect, useRef } from "react";
import { ChevronDown, Layers2, X } from "lucide-react";
import { Checkbox } from "../../../components/ui/checkbox";
import { TranslationKey } from "@/i18n/translations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

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
  const previousDatasetsRef = useRef<string[]>([]);

  useEffect(() => {
    const currentDatasetIds = trackedDatasets.map((dataset) => dataset.id);
    const previousDatasetIds = previousDatasetsRef.current;

    const newDatasets = currentDatasetIds.filter(
      (id) => !previousDatasetIds.includes(id)
    );

    if (newDatasets.length > 0) {
      const expansionState: Record<string, boolean> = {};

      currentDatasetIds.forEach((id) => {
        expansionState[id] = false;
      });

      expansionState[newDatasets[0]] = true;

      setExpandedDatasets(expansionState);
    }

    previousDatasetsRef.current = currentDatasetIds;
  }, [trackedDatasets, setExpandedDatasets]);

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
            <mark key={i} className="bg-gray-200 px-0.5 rounded-omar">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Function to determine if we should use green styling - now checks only if there are selected layers
  const shouldUseGreenStyle = (dataset: TrackedDataset) => {
    return dataset.selectedLayers.length > 0;
  };

  return (
    <div
      className="space-y-3 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar"
      ref={datasetScrollContainerRef}
    >
      {trackedDatasets.length === 0 ? (
        <div className="text-center p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
          {t("no_datasets_selected")}
        </div>
      ) : (
        trackedDatasets.map((dataset) => {
          const isExpanded = expandedDatasets[dataset.id];
          const useGreenStyle = shouldUseGreenStyle(dataset);

          return (
            <div
              key={dataset.id}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
              data-dataset-id={dataset.id}
            >
              <div
                className={`flex items-center justify-between p-3 cursor-pointer ${
                  useGreenStyle
                    ? "bg-color-gn-primarylight/90"
                    : isExpanded
                    ? "bg-gray-100"
                    : "bg-white"
                }`}
                onClick={() => handleToggleDatasetExpansion(dataset.id)}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div
                    className={`rounded-md p-2 flex items-center justify-center flex-shrink-0 ${
                      useGreenStyle ? "bg-white" : "bg-color-gn-primarylight/10"
                    }`}
                  >
                    <Layers2
                      className={`h-4 w-4 ${
                        useGreenStyle
                          ? "text-color-gn-primary"
                          : "text-color-gn-primary"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className={`font-medium text-sm truncate ${
                        useGreenStyle ? "text-white" : "text-color-gn-secondary"
                      }`}
                    >
                      {highlightText(dataset.title)}
                    </span>
                    <div
                      className={`flex items-center text-xs mt-0.5 ${
                        useGreenStyle ? "text-white" : "text-color-gn-secondary"
                      }`}
                    >
                      <span>
                        {t("layers")}: {dataset.selectedLayers.length}/
                        {dataset.availableLayers.length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {onRemoveDataset && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDataset(dataset.id);
                            }}
                            className={`p-1 rounded-full ${
                              useGreenStyle
                                ? "bg-white/90 text-color-gn-secondary hover:text-red-500 hover:bg-white"
                                : "bg-gray-100 "
                            } transition-colors`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-white border text-color-gn-secondary shadow-lg">
                          <p>{t("remove_dataset_tooltip")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`p-1 rounded-full ${
                            useGreenStyle
                              ? "bg-white/90 text-color-gn-secondary hover:bg-white"
                              : "bg-gray-100"
                          } transition-transform duration-200 ${
                            isExpanded ? "-rotate-180" : ""
                          }`}
                        >
                          <ChevronDown
                            className={`h-4 w-4 ${
                              useGreenStyle
                                ? "text-color-gn-secondary hover:bg-white"
                                : "text-color-gn-secondary"
                            }`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-white border text-color-gn-secondary shadow-lg">
                        <p>{t("expand_collapse_tooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {isExpanded && (
                <div className="max-h-[25vh] overflow-y-auto dataset-layer-container custom-scrollbar divide-y divide-gray-100">
                  {dataset.availableLayers.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      {t("no_layers_available")}
                    </div>
                  ) : (
                    dataset.availableLayers.map((layer) => (
                      <div
                        key={`${dataset.id}-${layer.name}`}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
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
                          className="h-4 w-4 border-gray-300 rounded data-[state=checked]:bg-color-gn-primarylight data-[state=checked]:border-color-bg-color-gn-primarylight"
                        />
                        <label
                          htmlFor={`${dataset.id}-${layer.name}`}
                          className="text-sm cursor-pointer flex-1 text-gray-700 hover:text-gray-900"
                        >
                          {highlightText(layer.title)}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
