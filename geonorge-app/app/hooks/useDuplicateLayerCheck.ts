import { useState, useCallback } from "react";
import {
  ActiveLayerInfo,
  SearchResult,
} from "../components/chat_components/types";

interface UseDuplicateLayerCheckProps {
  activeLayerIds: string[];
  allWmsResultsMap: Map<string, SearchResult>;
}

interface CheckResult {
  isDuplicate: boolean;
  message?: string;
}

export const useDuplicateLayerCheck = ({
  activeLayerIds,
  allWmsResultsMap,
}: UseDuplicateLayerCheckProps) => {
  const [showDuplicateLayerAlert, setShowDuplicateLayerAlert] = useState(false);
  const [duplicateLayerAlertMessage, setDuplicateLayerAlertMessage] =
    useState("");

  const checkForDuplicateWmsLayer = useCallback(
    (layerInfoToCheck: ActiveLayerInfo): CheckResult => {
      const targetSourceUrl = layerInfoToCheck.sourceUrl;
      const targetLayerName = layerInfoToCheck.name;
      const targetLayerTitle = layerInfoToCheck.title;
      const targetSourceUuid = layerInfoToCheck.sourceUuid;

      if (
        !targetSourceUrl ||
        !targetSourceUuid ||
        !targetLayerName ||
        !targetLayerTitle
      ) {
        console.error(
          "[useDuplicateLayerCheck] Missing info for duplicate check:",
          layerInfoToCheck
        );
        return {
          isDuplicate: false,
          message: "Internal error: Missing layer info for check.",
        }; // Should not proceed if basic info is missing
      }

      console.log(
        `[Duplicate Check Hook] Starting for Target: Layer='${targetLayerName}', URL='${targetSourceUrl}', From UUID='${targetSourceUuid}'`
      );

      for (const activeId of activeLayerIds) {
        console.log(`-- Checking Active ID: ${activeId} --`);
        const uuidPattern =
          /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.*)$/i;
        const parts = activeId.match(uuidPattern);

        if (!parts || parts.length < 3) {
          console.log(
            `   Skipping activeId (UUID pattern parse fail): ${activeId}`
          );
          continue;
        }

        const activeSourceUuid = parts[1];
        const activeLayerName = parts[2];
        console.log(
          `   Active Parsed: UUID=${activeSourceUuid}, Layer=${activeLayerName}`
        );

        // Skip if it's the same layer from the *same* dataset (this check might be redundant if handled by caller, but safe to keep)
        if (activeSourceUuid === targetSourceUuid) {
          console.log(`   Skipping: Same dataset UUID (${activeSourceUuid})`);
          continue;
        }

        const activeSearchResult = allWmsResultsMap.get(activeSourceUuid);
        const activeSourceUrl = activeSearchResult?.wmsUrl?.wms_url;
        console.log(`   Active URL from Map: ${activeSourceUrl}`);

        // Check for match: same URL and same layer name
        const urlsMatch = activeSourceUrl === targetSourceUrl;
        const namesMatch = activeLayerName === targetLayerName;
        console.log(
          `   URLs Match: ${urlsMatch} ('${activeSourceUrl}' vs '${targetSourceUrl}')`
        );
        console.log(
          `   Names Match: ${namesMatch} ('${activeLayerName}' vs '${targetLayerName}')`
        );

        if (urlsMatch && namesMatch) {
          console.log(`   ** DUPLICATE DETECTED **`);
          const existingDatasetTitle =
            activeSearchResult?.title || "et annet datasett";
          const message = `Laget "${targetLayerTitle}" fra denne WMS-tjenesten er allerede aktivt via datasettet "${existingDatasetTitle}". Du kan kun ha én forekomst av dette kartlaget aktivt om gangen.`;
          return { isDuplicate: true, message };
        }
      }

      console.log(`[Duplicate Check Hook] Finished. No duplicate found.`);
      return { isDuplicate: false };
    },
    [activeLayerIds, allWmsResultsMap]
  ); // Dependencies for the check logic

  const handleDuplicateFound = useCallback((message: string) => {
    setDuplicateLayerAlertMessage(message);
    setShowDuplicateLayerAlert(true);
  }, []);

  return {
    checkForDuplicateWmsLayer,
    showDuplicateLayerAlert,
    duplicateLayerAlertMessage,
    setShowDuplicateLayerAlert, // Allow dialog to be closed manually
    handleDuplicateFound, // Expose handler to trigger alert state
  };
};
