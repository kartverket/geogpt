import { useState, useCallback } from "react";
import { SearchResult } from "../components/chat_components/types"; // Assuming path is correct relative to hooks dir

interface UseBulkDownloadProps {
  selectedDatasetsInfo: Map<string, SearchResult>;
  onDownloadsInitiated: () => void; // Callback to clear selection in parent
}

export const useBulkDownload = ({
  selectedDatasetsInfo,
  onDownloadsInitiated,
}: UseBulkDownloadProps) => {
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  const handleBulkDownloadClick = useCallback(() => {
    if (selectedDatasetsInfo.size > 0) {
      setShowDownloadDialog(true);
    } else {
      console.warn("Bulk download clicked with 0 items selected.");
    }
  }, [selectedDatasetsInfo.size]);

  const initiateDownloads = useCallback(async () => {
    console.log("Initiating bulk download for:", selectedDatasetsInfo);
    const downloadLinks: HTMLAnchorElement[] = [];

    selectedDatasetsInfo.forEach((dataset) => {
      if (dataset.downloadUrl) {
        console.log(
          `Creating download link for ${dataset.title || dataset.uuid} at ${
            dataset.downloadUrl
          }`
        );
        const link = document.createElement("a");
        link.href = dataset.downloadUrl;
        link.setAttribute(
          "download",
          dataset.title || `dataset-${dataset.uuid}`
        ); // Suggest a filename
        link.setAttribute("target", "_blank");
        link.style.display = "none";
        document.body.appendChild(link);
        downloadLinks.push(link);
      } else {
        console.warn(
          `Dataset ${dataset.title || dataset.uuid} has no downloadUrl.`
        );
      }
    });

    console.log(`Attempting to click ${downloadLinks.length} download links.`);
    try {
      for (const link of downloadLinks) {
        link.click();
        await new Promise((resolve) => setTimeout(resolve, 150)); // Slightly increased delay
      }
    } catch (error) {
      console.error("Error clicking download links:", error);
    } finally {
      // Cleanup links after a delay
      setTimeout(() => {
        console.log(`Cleaning up ${downloadLinks.length} download links.`);
        downloadLinks.forEach((link) => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        });
      }, 2000); // Increased cleanup delay

      // Close dialog and trigger callback to clear selection
      setShowDownloadDialog(false);
      onDownloadsInitiated(); // Use the callback
    }
  }, [selectedDatasetsInfo, onDownloadsInitiated]);

  return {
    showDownloadDialog,
    setShowDownloadDialog, // Expose setter for the dialog component
    handleBulkDownloadClick,
    initiateDownloads,
  };
};
