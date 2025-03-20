import { useState } from "react";
import L from "leaflet";
import { WMSLayer } from "@/types/map";
import { TrackedDataset } from "@/types/datasets";

export function useWmsLayers(map: L.Map | null) {
  const [wmsUrl, setWmsUrl] = useState<string>("");
  const [availableLayers, setAvailableLayers] = useState<WMSLayer[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [wmsLayer, setWmsLayer] = useState<Record<string, L.TileLayer.WMS>>({});
  const [trackedDatasets, setTrackedDatasets] = useState<TrackedDataset[]>([]);
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [duplicateDatasetTitle, setDuplicateDatasetTitle] = useState("");

  const fetchWMSInfo = async (
    urlToFetch?: string,
    datasetId?: string,
  ) => {
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

  const updateLayers = () => {
    if (!map) return;

    // Remove layers that are no longer selected
    Object.entries(wmsLayer).forEach(([name, layer]) => {
      if (!selectedLayers.includes(name)) {
        map.removeLayer(layer);
        delete wmsLayer[name];
      }
    });

    // Add or update selected layers
    selectedLayers.forEach((layerName) => {
      if (!wmsLayer[layerName]) {
        const baseWmsUrl = wmsUrl.split("?")[0];
        const newWmsLayer = L.tileLayer.wms(baseWmsUrl, {
          layers: layerName,
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          zIndex: 10,
        });
        newWmsLayer.addTo(map);
        wmsLayer[layerName] = newWmsLayer;
      }
    });

    setWmsLayer({ ...wmsLayer });
  };

  const handleLayerChange = (layerName: string, isChecked: boolean) => {
    setSelectedLayers((prev) => {
      if (isChecked && !prev.includes(layerName)) {
        return [...prev, layerName];
      }
      if (!isChecked && prev.includes(layerName)) {
        return prev.filter((name) => name !== layerName);
      }
      return prev;
    });
  };

  const handleLayerChangeWithDataset = (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => {
    const dataset = trackedDatasets.find((d) => d.id === datasetId);
    if (!dataset || !map) return;

    // Update selected layers in the dataset
    setTrackedDatasets((prevDatasets) =>
      prevDatasets.map((dataset) =>
        dataset.id === datasetId
          ? {
              ...dataset,
              selectedLayers: isChecked
                ? [...dataset.selectedLayers, layerName]
                : dataset.selectedLayers.filter((name) => name !== layerName),
            }
          : dataset
      )
    );

    // Add or remove the layer from the map
    const layerId = `${datasetId}:${layerName}`;

    if (isChecked && !wmsLayer[layerId]) {
      const baseWmsUrl = dataset.wmsUrl.split("?")[0];
      const newWmsLayer = L.tileLayer.wms(baseWmsUrl, {
        layers: layerName,
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        zIndex: 10,
      });

      newWmsLayer.addTo(map);
      setWmsLayer((prev) => ({
        ...prev,
        [layerId]: newWmsLayer,
      }));
    } else if (!isChecked && wmsLayer[layerId]) {
      map.removeLayer(wmsLayer[layerId]);
      setWmsLayer((prev) => {
        const newLayers = { ...prev };
        delete newLayers[layerId];
        return newLayers;
      });
    }
  };

  const removeTrackedDataset = (datasetId: string) => {
    if (map) {
      trackedDatasets
        .find((dataset) => dataset.id === datasetId)
        ?.selectedLayers.forEach((layerName) => {
          const layerId = `${datasetId}:${layerName}`;
          if (wmsLayer[layerId]) {
            map.removeLayer(wmsLayer[layerId]);

            // Remove from wmsLayer state
            setWmsLayer((prev) => {
              const newLayers = { ...prev };
              delete newLayers[layerId];
              return newLayers;
            });
          }
        });
    }

    setTrackedDatasets((prev) =>
      prev.filter((dataset) => dataset.id !== datasetId)
    );
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

    if (extractedLayers.length > 0 && map) {
      const baseWmsUrl = processedWmsUrl.split("?")[0];
      const layerName = extractedLayers[0].name;
      const newWmsLayer = L.tileLayer.wms(baseWmsUrl, {
        layers: layerName,
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        zIndex: 10,
      });

      newWmsLayer.addTo(map);
      setWmsLayer((prev) => ({
        ...prev,
        [`${datasetId}:${layerName}`]: newWmsLayer,
      }));
    }
  };

  return {
    wmsUrl,
    setWmsUrl,
    availableLayers,
    setAvailableLayers,
    selectedLayers,
    setSelectedLayers,
    wmsLayer,
    setWmsLayer,
    trackedDatasets,
    setTrackedDatasets,
    isDuplicateAlertOpen,
    setIsDuplicateAlertOpen,
    duplicateDatasetTitle,
    setDuplicateDatasetTitle,
    fetchWMSInfo,
    updateLayers,
    handleLayerChange,
    handleLayerChangeWithDataset,
    removeTrackedDataset,
    replaceIframe
  };
}
