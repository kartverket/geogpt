import { useState, useCallback } from "react";
import { SearchResult } from "../components/chat_components/types";

const MAX_RECENT_DATASETS = 10;

export const useRecentDatasets = (initialDatasets: SearchResult[] = []) => {
  const [recentDatasets, setRecentDatasets] =
    useState<SearchResult[]>(initialDatasets);

  const addRecentDataset = useCallback(
    (datasetToAdd: SearchResult | null | undefined) => {
      if (!datasetToAdd || !datasetToAdd.uuid) {
        console.warn(
          "[useRecentDatasets] Attempted to add invalid dataset:",
          datasetToAdd
        );
        return;
      }

      setRecentDatasets((prev) => {
        // Remove if already exists to move it to the front
        const deduped = prev.filter((d) => d.uuid !== datasetToAdd.uuid);
        // Add the new dataset to the beginning and slice to limit size
        const updatedRecents = [datasetToAdd, ...deduped].slice(
          0,
          MAX_RECENT_DATASETS
        );
        console.log(
          "[useRecentDatasets] Updated recent datasets:",
          updatedRecents.map((d) => d.title)
        ); // Log titles for clarity
        return updatedRecents;
      });
    },
    []
  ); // Dependency array is empty as it only uses its own state setter

  return {
    recentDatasets,
    addRecentDataset,
  };
};
