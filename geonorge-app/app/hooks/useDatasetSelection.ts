import { useState, useCallback } from "react";
import { SearchResult } from "../components/chat_components/types";

export const useDatasetSelection = () => {
  const [selectedDatasetsInfo, setSelectedDatasetsInfo] = useState<
    Map<string, SearchResult>
  >(new Map());

  const handleSelectDataset = useCallback((dataset: SearchResult) => {
    if (!dataset || !dataset.uuid) {
      console.warn("Attempted to select a dataset without a UUID:", dataset);
      return;
    }
    setSelectedDatasetsInfo((prevInfo) => {
      const newMap = new Map(prevInfo);
      if (newMap.has(dataset.uuid!)) {
        newMap.delete(dataset.uuid!);
      } else {
        newMap.set(dataset.uuid!, dataset);
      }
      return newMap;
    });
  }, []); // Empty dependency array as it doesn't depend on component props/state

  const clearSelectedDatasets = useCallback(() => {
    setSelectedDatasetsInfo(new Map());
  }, []); // Empty dependency array

  return {
    selectedDatasetsInfo,
    handleSelectDataset,
    clearSelectedDatasets,
  };
};
