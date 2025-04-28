import { useState, useEffect, useCallback, FormEvent } from "react";
import { SearchResult } from "../components/chat_components/types";

interface UseSearchManagementProps {
  ws: WebSocket | null;
  updateWmsResultsMap: (results: SearchResult[]) => void; // From useWmsLayerManagement
  onFilterTypeChange: (filter: string | null) => void; // From LayerPanel props
}

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

  // WebSocket listener for search results
  useEffect(() => {
    if (ws) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.action === "searchVdbResults" ||
            data.action === "searchResults"
          ) {
            const newResults: SearchResult[] = data.payload || [];
            console.log(
              "[useSearchManagement] Received search results:",
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
      // If WS disconnects, clear searching state
      if (isSearching) {
        console.log(
          "[useSearchManagement] WS is null, resetting searching state."
        );
        setIsSearching(false);
      }
    }
  }, [ws, updateWmsResultsMap, isSearching]); // Added isSearching dependency

  const handleSearchSubmit = useCallback(
    (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault(); // Allow calling without event
      if (!ws || ws.readyState !== WebSocket.OPEN || !searchTerm.trim()) {
        console.warn(
          "[useSearchManagement] WS send prevented due to state or empty term."
        );
        if (!searchTerm.trim()) {
          setCurrentSearchResults([]); // Clear results if search term is empty
          setHasSearched(true); // Mark as searched to show "empty" message
        }
        return;
      }
      console.log("[useSearchManagement] Sending search request:", searchTerm);
      setIsSearching(true);
      setHasSearched(true);
      setCurrentSearchResults([]); // Clear previous results immediately
      ws.send(
        JSON.stringify({
          action: "searchFormSubmit",
          payload: searchTerm,
        })
      );
    },
    [ws, searchTerm]
  ); // Dependencies: ws instance and the current search term

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    onFilterTypeChange(null); // Reset filter in parent
    setHasSearched(false);
    setIsSearching(false);
    setCurrentSearchResults([]); // Clear results
    // Note: We don't clear the allWmsResultsMap here, only the current display results
    console.log("[useSearchManagement] Search cleared.");
  }, [onFilterTypeChange]); // Dependency: parent's filter change handler

  return {
    searchTerm,
    setSearchTerm,
    isSearching,
    hasSearched,
    currentSearchResults, // Return the locally held results for display
    handleSearchSubmit,
    clearSearch,
  };
};
