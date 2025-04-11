import { useState } from "react";
import {
  dedupeFormats,
  dedupeAreas,
  dedupeProjections,
  getAreaFormatsAndProjections,
} from "@/utils/datasetUtils";
import { SearchResult } from "@/app/components/chat_components/types";

export const useDownloadManagement = () => {
  const [isFileDownloadModalOpen, setFileDownloadModalOpen] =
    useState<boolean>(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(
    null
  );
  const [geographicalAreas, setGeographicalAreas] = useState<
    { type: string; name: string; code: string }[]
  >([]);
  const [projections, setProjections] = useState<
    { name: string; code: string }[]
  >([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState<string>("");
  const [specificObject, setSpecificObject] = useState<SearchResult | null>(
    null
  );

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

  const executeDatasetDownload = (dataset: SearchResult) => {
    if (!dataset) {
      console.error("No dataset provided.");
      return;
    }

    setSpecificObject(dataset);

    const downloadFormats = dataset.downloadFormats || [];
    if (downloadFormats.length > 0) {
      // Extract and dedupe geographical areas
      const rawGeoAreas = downloadFormats.map(
        (fmt: { type: any; name: any; code: any }) => ({
          type: fmt.type,
          name: fmt.name,
          code: fmt.code,
        })
      );
      setGeographicalAreas(dedupeAreas(rawGeoAreas));

      // Extract projections and formats
      const rawProjections = downloadFormats
        .flatMap(
          (fmt: { projections?: { name: string; code: string }[] }) =>
            fmt.projections || []
        )
        .map((proj: { name: any; code: any }) => ({
          name: proj.name,
          code: proj.code,
        }));
      setProjections(dedupeProjections(rawProjections));

      const rawFormats = downloadFormats
        .flatMap((fmt: { formats?: { name: string }[] }) => fmt.formats || [])
        .map((format: { name: any }) => format.name);
      setFormats(dedupeFormats(rawFormats));

      setDatasetName(dataset.title || "");
      setPendingDownloadUrl(dataset.downloadUrl || null); // Store the standard download URL
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

  const confirmDownload = () => {
    if (!pendingDownloadUrl) return;
    handleDirectDownload(pendingDownloadUrl);
    setFileDownloadModalOpen(false);
    setPendingDownloadUrl(null);
  };

  const handleStandardDownload = () => {
    if (pendingDownloadUrl) {
      handleDirectDownload(pendingDownloadUrl);
    }
  };

  const handleModalClose = () => {
    setFileDownloadModalOpen(false);
  };

  return {
    isFileDownloadModalOpen,
    pendingDownloadUrl,
    geographicalAreas,
    projections,
    formats,
    datasetName,
    specificObject,
    setFileDownloadModalOpen,
    setPendingDownloadUrl,
    setSpecificObject,
    handleAreaChange,
    executeDatasetDownload,
    handleDirectDownload,
    confirmDownload,
    handleStandardDownload,
    handleModalClose,
  };
};
