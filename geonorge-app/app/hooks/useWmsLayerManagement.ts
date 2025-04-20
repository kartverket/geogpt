import { useState, useEffect, useCallback } from "react";
import { SearchResult } from "../components/chat_components/types";

interface UseWmsLayerManagementProps {
  newlyAddedDatasetInfo?: SearchResult | null;
  addRecentDataset: (dataset: SearchResult) => void; // From useRecentDatasets
  onDatasetProcessed?: (uuid: string) => void; // Optional: Callback after processing external dataset
}

export const useWmsLayerManagement = ({
  newlyAddedDatasetInfo,
  addRecentDataset,
  onDatasetProcessed,
}: UseWmsLayerManagementProps) => {
  const [allWmsResultsMap, setAllWmsResultsMap] = useState<
    Map<string, SearchResult>
  >(new Map());
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Process externally added dataset info
  useEffect(() => {
    if (newlyAddedDatasetInfo && newlyAddedDatasetInfo.uuid) {
      const datasetUuid = newlyAddedDatasetInfo.uuid;
      setAllWmsResultsMap((prevMap) => {
        if (!prevMap.has(datasetUuid)) {
          const newMap = new Map(prevMap);
          newMap.set(datasetUuid, newlyAddedDatasetInfo);
          console.log(
            "[useWmsLayerManagement] Ensuring dataset from external source is known:",
            newlyAddedDatasetInfo.title
          );

          // Expand the category for the newly added dataset
          setExpandedCategories((prevExpanded) => {
            if (!prevExpanded.includes(datasetUuid)) {
              return [...prevExpanded, datasetUuid];
            }
            return prevExpanded;
          });

          // Add to recent datasets via the passed-in function
          addRecentDataset(newlyAddedDatasetInfo);

          // Optional: Notify parent component that dataset has been processed
          onDatasetProcessed?.(datasetUuid);

          return newMap;
        }
        return prevMap; // Dataset already known
      });
    }
  }, [newlyAddedDatasetInfo, addRecentDataset, onDatasetProcessed]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []); // Only depends on its own setter

  // Function to update the map from search results (will be used by search hook later)
  const updateWmsResultsMap = useCallback((newResults: SearchResult[]) => {
    setAllWmsResultsMap((prevMap) => {
      const newMap = new Map(prevMap);
      newResults.forEach((result) => {
        // Ensure we only add datasets with WMS capability and a UUID
        if (result.uuid && result.wmsUrl) {
          newMap.set(result.uuid, result);
        }
      });
      console.log(
        "[useWmsLayerManagement] Updated WMS map from search results:",
        newMap.size,
        "entries"
      );
      return newMap;
    });
  }, []);

  return {
    allWmsResultsMap,
    expandedCategories,
    toggleCategory,
    updateWmsResultsMap, // Expose function to add search results
    // We don't need to return setAllWmsResultsMap directly if updateWmsResultsMap handles updates
  };
};
