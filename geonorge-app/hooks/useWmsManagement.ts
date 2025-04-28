import { useState } from "react";
import { WMSLayer } from "@/app/components/chat_components/types";

export interface TrackedDataset {
  id: string;
  title: string;
  wmsUrl: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
}

export const useWmsManagement = () => {
  const [wmsUrl, setWmsUrl] = useState<string>("");
  const [availableLayers, setAvailableLayers] = useState<WMSLayer[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [trackedDatasets, setTrackedDatasets] = useState<TrackedDataset[]>([]);
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [duplicateDatasetTitle, setDuplicateDatasetTitle] = useState("");

  const fetchWMSInfo = async (urlToFetch?: string, datasetId?: string) => {
    if (!urlToFetch && !wmsUrl) {
      return { available_layers: [] };
    }

    try {
      const apiUrl = `http://127.0.0.1:5000/wms-info?url=${encodeURIComponent(
        urlToFetch || wmsUrl
      )}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (datasetId) {
        setTrackedDatasets((prevDatasets) =>
          prevDatasets.map((dataset) =>
            dataset.id === datasetId
              ? {
                  ...dataset,
                  availableLayers: data.available_layers,
                  selectedLayers:
                    dataset.selectedLayers.length > 0
                      ? dataset.selectedLayers
                      : data.available_layers.length > 0
                      ? [data.available_layers[0].name]
                      : [],
                }
              : dataset
          )
        );
      } else {
        setAvailableLayers(data.available_layers);
        if (data.available_layers.length > 0 && selectedLayers.length === 0) {
          setSelectedLayers([data.available_layers[0].name]);
        }
      }

      return data;
    } catch (error) {
      console.error("Error fetching WMS info:", error);
      return { available_layers: [] };
    }
  };

  const replaceIframe = async (wmsUrl: any, datasetTitle?: string) => {
    if (
      !wmsUrl ||
      wmsUrl === "NONE" ||
      (typeof wmsUrl === "string" && wmsUrl.toLowerCase() === "none")
    ) {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }

    let processedWmsUrl: string;
    let extractedLayers: WMSLayer[] = [];
    let extractedTitle: string | undefined = datasetTitle;

    if (typeof wmsUrl === "object" && wmsUrl.wms_url) {
      processedWmsUrl = wmsUrl.wms_url;
      extractedLayers = wmsUrl.available_layers || [];
      extractedTitle = wmsUrl.title || datasetTitle;
    } else {
      try {
        const wmsData =
          typeof wmsUrl === "string" && wmsUrl.startsWith("{")
            ? JSON.parse(wmsUrl)
            : { wms_url: wmsUrl };

        if (wmsData.wms_url) {
          processedWmsUrl = wmsData.wms_url;
          extractedLayers = wmsData.available_layers || [];
          extractedTitle = wmsData.title || datasetTitle;
        } else {
          processedWmsUrl = wmsUrl;
        }
      } catch (error) {
        processedWmsUrl = wmsUrl;
      }
    }

    const baseWmsUrl = processedWmsUrl.split("?")[0];
    const isDuplicate = trackedDatasets.some((dataset) => {
      const existingBaseUrl = dataset.wmsUrl.split("?")[0];
      return existingBaseUrl === baseWmsUrl;
    });

    if (isDuplicate) {
      setDuplicateDatasetTitle(extractedTitle || "Dette datasettet");
      setIsDuplicateAlertOpen(true);
      return;
    }

    const datasetId = `dataset-${Date.now()}`;
    const title = extractedTitle || `Dataset ${trackedDatasets.length + 1}`;

    if (extractedLayers.length === 0) {
      const layerData = await fetchWMSInfo(processedWmsUrl);
      extractedLayers = layerData.available_layers || [];
    }

    const newDataset: TrackedDataset = {
      id: datasetId,
      title: title,
      wmsUrl: processedWmsUrl,
      availableLayers: extractedLayers,
      selectedLayers:
        extractedLayers.length > 0 ? [extractedLayers[0].name] : [],
    };

    setTrackedDatasets((prev) => [...prev, newDataset]);
  };

  const removeTrackedDataset = (datasetId: string) => {
    setTrackedDatasets((prev) =>
      prev.filter((dataset) => dataset.id !== datasetId)
    );
  };

  const handleLayerChangeWithDataset = (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => {
    setTrackedDatasets((prevDatasets) =>
      prevDatasets.map((dataset) =>
        dataset.id === datasetId
          ? {
              ...dataset,
              selectedLayers: isChecked
                ? [...dataset.selectedLayers, layerName]
                : dataset.selectedLayers.filter(
                    (name: string) => name !== layerName
                  ),
            }
          : dataset
      )
    );
  };

  return {
    wmsUrl,
    availableLayers,
    selectedLayers,
    trackedDatasets,
    isDuplicateAlertOpen,
    duplicateDatasetTitle,
    setWmsUrl,
    setAvailableLayers,
    setSelectedLayers,
    setIsDuplicateAlertOpen,
    fetchWMSInfo,
    replaceIframe,
    removeTrackedDataset,
    handleLayerChangeWithDataset,
  };
};
