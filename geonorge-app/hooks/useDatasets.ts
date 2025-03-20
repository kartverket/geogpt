import { useState } from "react";
import { SearchResult } from "@/types/datasets";
import { dedupeFormats, dedupeAreas, dedupeProjections, getAreaFormatsAndProjections } from "@/utils/datasetUtils";

export function useDatasets() {
  const [specificObject, setSpecificObject] = useState<SearchResult | null>(null);
  const [uuidToFind, setUuidToFind] = useState<string>("");
  const [datasetName, setDatasetName] = useState<string>("");
  
  // File download modal state
  const [isFileDownloadModalOpen, setFileDownloadModalOpen] = useState<boolean>(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);
  
  // Download formats
  const [geographicalAreas, setGeographicalAreas] = useState<
    { type: string; name: string; code: string }[]
  >([]);
  const [projections, setProjections] = useState<
    { name: string; code: string }[]
  >([]);
  const [formats, setFormats] = useState<string[]>([]);

  const executeDatasetDownload = (dataset: SearchResult) => {
    if (!dataset) {
      console.error("No dataset provided.");
      return;
    }
    setSpecificObject(dataset);
    
    const downloadFormats = dataset.downloadFormats || [];
    if (downloadFormats.length > 0) {
      // Extract and dedupe geographical areas
      const rawGeoAreas = downloadFormats.map((fmt) => ({
        type: fmt.type,
        name: fmt.name,
        code: fmt.code,
      }));
      setGeographicalAreas(dedupeAreas(rawGeoAreas));

      // Extract projections and formats
      const rawProjections = downloadFormats
        .flatMap((fmt) => fmt.projections || [])
        .map((proj) => ({
          name: proj.name,
          code: proj.code,
        }));
      setProjections(dedupeProjections(rawProjections));

      const rawFormats = downloadFormats
        .flatMap((fmt) => fmt.formats || [])
        .map((format) => format.name);
      setFormats(dedupeFormats(rawFormats));

      setDatasetName(dataset.title || "");
      setPendingDownloadUrl(dataset.downloadUrl || null);
      setFileDownloadModalOpen(true);
    } else if (dataset.downloadUrl) {
      // If no formats but URL exists, use standard download
      handleDirectDownload(dataset.downloadUrl);
    } else {
      console.warn("No download URL or formats available for this dataset");
    }
  };

  const handleDirectDownload = (url: string) => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAreaChange = (selectedAreaCode: string) => {
    if (!specificObject) return;

    const { projections: updatedProjections, formats: updatedFormats } =
      getAreaFormatsAndProjections(
        selectedAreaCode,
        specificObject.downloadFormats || []
      );

    setProjections(updatedProjections);
    setFormats(updatedFormats);
  };

  return {
    specificObject,
    setSpecificObject,
    uuidToFind,
    setUuidToFind,
    datasetName,
    setDatasetName,
    isFileDownloadModalOpen,
    setFileDownloadModalOpen,
    pendingDownloadUrl,
    setPendingDownloadUrl,
    geographicalAreas,
    setGeographicalAreas,
    projections,
    setProjections,
    formats,
    setFormats,
    executeDatasetDownload,
    handleDirectDownload,
    handleAreaChange,
  };
}
