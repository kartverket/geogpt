import { useState, useEffect, useCallback, FormEvent } from "react";
import { SearchResult, WMSLayer } from "../components/chat_components/types";

interface DownloadFormatSelection {
  areaCode?: string;
  areaName?: string;
  areaType?: string;
  projectionCode?: string;
  projectionName?: string;
  projectionCodespace?: string;
  formatCode?: string;
  formatName?: string;
  formatType?: string;
  usagePurpose?: string;
}

interface GeonorgeApiResult {
  Uuid: string;
  Title: string;
  Abstract: string;
  Organization: string;
  ThumbnailUrl: string;
  Type: string;
  DistributionUrl: string;
  DistributionProtocol: string;
  DatasetServices?: Array<{
    Protocol: string;
    GetCapabilitiesUrl: string;
    Name?: string;
  }>;
  ServiceDistributionUrlForDataset?: string;
  AccessIsRestricted?: boolean;
  AccessIsOpendata?: boolean;
  AccessIsProtected?: boolean;
  // Add other fields if needed
}

interface UseSearchManagementProps {
  ws: WebSocket | null;
  updateWmsResultsMap: (results: SearchResult[]) => void; // From useWmsLayerManagement
  onFilterTypeChange: (filter: string | null) => void; // From LayerPanel props
}

export type SearchMethod = "websocket" | "http";

export const useSearchManagement = ({
  ws,
  updateWmsResultsMap,
  onFilterTypeChange,
}: UseSearchManagementProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentSearchResults, setCurrentSearchResults] = useState<
    SearchResult[]
  >([]); // Store results locally for display
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("websocket"); // Default to websocket

  // --- Start: HTTP Search Logic ---

  // Updated helper to find WMS info using ServiceDistributionUrlForDataset
  const findWmsInfo = (
    apiResult: GeonorgeApiResult
  ): SearchResult["wmsUrl"] => {
    const wmsUrl = apiResult.ServiceDistributionUrlForDataset;

    if (wmsUrl) {
      // NOTE: The API doesn't directly provide available_layers list per dataset here.
      // We return the base URL. A full implementation might require fetching GetCapabilities later.
      // Also using the dataset title as a placeholder for WMS title.
      return {
        wms_url: wmsUrl,
        available_layers: [], // Placeholder - requires GetCapabilities fetch
        title: apiResult.Title || "", // Use dataset title as placeholder
      };
    }
    return undefined; // Changed from null to undefined to match type
  };

  const fetchHttpSearchResults = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setCurrentSearchResults([]);
        setHasSearched(true);
        setIsSearching(false);
        return;
      }
      console.log(
        "[useSearchManagement] Fetching HTTP search results for:",
        term
      );
      setIsSearching(true);
      setHasSearched(true);
      setCurrentSearchResults([]); // Clear previous results

      // --- Call Combined Backend Endpoint ---
      const backendBaseUrl = "http://localhost:5000"; // Add to env ...
      const backendSearchUrl = `${backendBaseUrl}/search-http?term=${encodeURIComponent(
        term
      )}`;
      console.log(
        `[useSearchManagement] Calling combined backend search: ${backendSearchUrl}`
      );

      try {
        const response = await fetch(backendSearchUrl);
        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg =
            errorData.error ||
            `Backend search failed: ${response.status} ${response.statusText}`;
          throw new Error(errorMsg);
        }

        const finalResults: SearchResult[] = await response.json();
        console.log(
          "[useSearchManagement] Received final results from combined backend search:",
          finalResults.length
        );

        setCurrentSearchResults(finalResults); // Set final results
        updateWmsResultsMap(finalResults); // Update the master WMS map
      } catch (error) {
        console.error(
          "[useSearchManagement] Failed to fetch or process combined backend search results:",
          error
        );
        setCurrentSearchResults([]); // Clear results on error
      } finally {
        setIsSearching(false);
      }
    },
    [updateWmsResultsMap]
  );

  // --- End: HTTP Search Logic ---

  // WebSocket listener for search results (remains largely the same)
  useEffect(() => {
    if (ws && searchMethod === "websocket") {
      // Only listen if WS is active method
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.action === "searchVdbResults" ||
            data.action === "searchResults"
          ) {
            const newResults: SearchResult[] = data.payload || [];
            console.log(
              "[useSearchManagement] Received WebSocket search results:",
              newResults.length
            );
            setIsSearching(false);
            setCurrentSearchResults(newResults); // Update local results for display
            updateWmsResultsMap(newResults); // Update the master WMS map
          }
        } catch (error) {
          console.error(
            "[useSearchManagement] Failed to parse WebSocket message:",
            error
          );
          setIsSearching(false); // Ensure loading state is reset on error
        }
      };

      ws.addEventListener("message", handleMessage);
      console.log("[useSearchManagement] Added WS message listener.");

      return () => {
        ws.removeEventListener("message", handleMessage);
        console.log("[useSearchManagement] Removed WS message listener.");
      };
    } else {
      if (isSearching && searchMethod === "websocket") {
        // If WS disconnects during a WS search, reset searching state.
        console.log(
          "[useSearchManagement] WS is null or method is HTTP, resetting WS searching state."
        );
        setIsSearching(false);
      }
    }
    // Include searchMethod in dependencies to re-evaluate listener attachment
  }, [ws, updateWmsResultsMap, isSearching, searchMethod]);

  // Modified search submit handler
  const handleSearchSubmit = useCallback(
    (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const term = searchTerm.trim();

      if (!term) {
        console.warn(
          "[useSearchManagement] Search prevented due to empty term."
        );
        setCurrentSearchResults([]);
        setHasSearched(true);
        setIsSearching(false);
        return;
      }

      if (searchMethod === "websocket") {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.warn(
            "[useSearchManagement] WebSocket send prevented: WS not open."
          );
          setIsSearching(false); // Stop searching if WS isn't ready
          // Optionally: show an error message or try HTTP fallback?
          return;
        }
        console.log(
          "[useSearchManagement] Sending WebSocket search request:",
          term
        );
        setIsSearching(true);
        setHasSearched(true);
        setCurrentSearchResults([]); // Clear previous results
        ws.send(
          JSON.stringify({
            action: "searchFormSubmit",
            payload: term,
          })
        );
      } else {
        // searchMethod === 'http'
        fetchHttpSearchResults(term);
      }
    },
    [ws, searchTerm, searchMethod, fetchHttpSearchResults] // Dependencies updated
  );

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    onFilterTypeChange(null);
    setHasSearched(false);
    setIsSearching(false);
    setCurrentSearchResults([]);
  }, [onFilterTypeChange]);

  // --- Start: Function to request download URL from backend ---
  const requestDatasetDownload = useCallback(
    async (
      metadataUuid: string,
      downloadFormats: DownloadFormatSelection
    ): Promise<string | null> => {
      const backendBaseUrl = "http://localhost:5000"; // Add to env ...

      const downloadApiUrl = `${backendBaseUrl}/download-dataset`;

      console.log(
        `[useSearchManagement] Requesting download for ${metadataUuid} with formats:`,
        downloadFormats
      );

      try {
        const response = await fetch(downloadApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ metadataUuid, downloadFormats }),
        });

        const responseData = await response.json(); // Attempt to parse JSON regardless of status

        if (!response.ok) {
          const errorMsg =
            responseData.error ||
            `HTTP error ${response.status} ${response.statusText}`;
          console.error(
            `[useSearchManagement] Failed to request download URL for ${metadataUuid}:`,
            errorMsg
          );

          alert(`Error requesting download: ${errorMsg}`);
          return null;
        }

        if (responseData.downloadUrl) {
          console.log(
            `[useSearchManagement] Received download URL for ${metadataUuid}:`,
            responseData.downloadUrl
          );
          return responseData.downloadUrl;
        } else {
          console.warn(
            `[useSearchManagement] Backend response OK but no download URL found for ${metadataUuid}`
          );
          alert("Download order processed, but no download URL was returned.");
          return null;
        }
      } catch (error) {
        console.error(
          `[useSearchManagement] Network or other error requesting download URL for ${metadataUuid}:`,
          error
        );
        alert(
          `Error requesting download: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      }
    },
    []
  );

  return {
    searchTerm,
    setSearchTerm,
    isSearching,
    hasSearched,
    currentSearchResults,
    handleSearchSubmit,
    clearSearch,
    searchMethod,
    setSearchMethod,
    requestDatasetDownload,
  };
};
