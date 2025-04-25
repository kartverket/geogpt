import React, { useMemo, useState, useEffect } from "react";
import { Clock, Loader2, MapIcon, Search, Trash2, Layers2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "./chat_components/useWebSocket";
import { SearchResult, ActiveLayerInfo } from "./chat_components/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import DatasetItem from "./layer_panel_components/dataset_items/DatasetItem";
import SearchForm from "./layer_panel_components/SearchForm";
import FilterControls from "./layer_panel_components/FilterControls";
import BulkActionBar from "./layer_panel_components/BulkActionBar";
import BulkDownloadDialog from "./layer_panel_components/BulkDownloadDialog";
import DuplicateLayerAlertDialog from "./layer_panel_components/DuplicateLayerAlertDialog";
import { useDatasetSelection } from "../hooks/useDatasetSelection";
import { useBulkDownload } from "../hooks/useBulkDownload";
import { useRecentDatasets } from "../hooks/useRecentDatasets";
import { useDuplicateLayerCheck } from "../hooks/useDuplicateLayerCheck";
import { useWmsLayerManagement } from "../hooks/useWmsLayerManagement";
import { useSearchManagement } from "../hooks/useSearchManagement";

// Define props for LayerPanel
interface LayerPanelProps {
  activeLayerIds: string[];
  onToggleLayer: (layerInfo: ActiveLayerInfo, isChecked: boolean) => void;
  onDatasetDownload: (dataset: SearchResult) => void;
  filterType: string | null;
  onFilterTypeChange: (newFilter: string | null) => void;
  // Prop to receive dataset info added externally
  newlyAddedDatasetInfo?: SearchResult | null;
  // Add prop for removing all layers
  onRemoveAllLayers: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  activeLayerIds,
  onToggleLayer,
  onDatasetDownload,
  filterType,
  onFilterTypeChange,
  // Destructure the new prop
  newlyAddedDatasetInfo,
  onRemoveAllLayers,
}) => {
  const { searchResults, ws } = useWebSocket();
  const { selectedDatasetsInfo, handleSelectDataset, clearSelectedDatasets } =
    useDatasetSelection();
  const {
    showDownloadDialog,
    setShowDownloadDialog,
    handleBulkDownloadClick,
    initiateDownloads,
  } = useBulkDownload({
    selectedDatasetsInfo,
    onDownloadsInitiated: clearSelectedDatasets,
  });
  const { recentDatasets, addRecentDataset } = useRecentDatasets();
  const {
    allWmsResultsMap,
    expandedCategories,
    toggleCategory,
    updateWmsResultsMap,
  } = useWmsLayerManagement({
    newlyAddedDatasetInfo,
    addRecentDataset,
  });
  const {
    checkForDuplicateWmsLayer,
    showDuplicateLayerAlert,
    duplicateLayerAlertMessage,
    setShowDuplicateLayerAlert,
    handleDuplicateFound,
  } = useDuplicateLayerCheck({ activeLayerIds, allWmsResultsMap });

  // Initialize Search Management Hook
  const {
    searchTerm,
    setSearchTerm,
    isSearching,
    hasSearched,
    currentSearchResults,
    handleSearchSubmit,
    clearSearch,
    searchMethod,
    setSearchMethod,
  } = useSearchManagement({
    ws,
    updateWmsResultsMap,
    onFilterTypeChange,
  });

  const displayedResults = useMemo(() => {
    if (filterType === "active") {
      const allKnownWmsResults = Array.from(allWmsResultsMap.values());
      return allKnownWmsResults.filter((result) => {
        const wmsInfo = result.wmsUrl;
        if (!result.uuid || !wmsInfo || !wmsInfo.available_layers) {
          return false;
        }
        return activeLayerIds.some((activeId) =>
          activeId.startsWith(`${result.uuid}-`)
        );
      });
    }
    // Implement 'popular' filter if needed here
    // Default: return latest search results
    return currentSearchResults;
  }, [currentSearchResults, filterType, activeLayerIds, allWmsResultsMap]);

  const handleLayerToggleRequest = (
    layerInfo: ActiveLayerInfo,
    isChecked: boolean,
    searchResult: SearchResult
  ) => {
    console.log(
      `[LayerPanel] handleLayerToggleRequest called for ${layerInfo.id}, isChecked: ${isChecked}`
    );

    // --- Start Duplicate Check Logic (only if activating) ---
    if (isChecked === true) {
      const checkResult = checkForDuplicateWmsLayer(layerInfo);
      if (checkResult.isDuplicate) {
        handleDuplicateFound(checkResult.message!); // Use hook's function to show alert
        return; // <<< PREVENT TOGGLING
      }
    }
    // --- End Duplicate Check Logic ---

    // --- Proceed with Toggle and Recent Update ---
    console.log(`[LayerPanel] No duplicate found or deactivating. Proceeding.`);
    // Call the original toggle handler passed from the parent
    onToggleLayer(layerInfo, isChecked);

    // Update recent datasets only when activating
    if (isChecked) {
      addRecentDataset(searchResult);
    }
  };

  // Add state to track initial loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Simulate initial loading effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Component for initial loading state
  const InitialState = () => (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full">
      <div className="relative mb-6">
        <div className="p-4 bg-gray-50 rounded-full border-2 border-gray-100">
          <MapIcon className="h-12 w-12 text-color-gn-primary animate-typing-dot-bounce" />
        </div>
      </div>

      <h3 className="text-lg font-medium mb-2 text-color-gn-secondarylight">
        Velkommen til Kartkatalogen
      </h3>
      <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
        <Loader2 className="h-4 w-4 text-color-gn-secondarylight animate-spin" />
        <span className="text-sm font-medium text-color-gn-secondarylight">
          Datasett lastes inn, vennligst vent...
        </span>
      </div>
    </div>
  );

  // Component for no results state
  const NoResults = () => (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="rounded-full bg-gray-100 p-3 mb-4">
        <Search className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium mb-2 text-gray-700">
        Ingen resultater funnet
      </h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Prøv med andre søkeord eller sjekk stavemåten på søket ditt.
      </p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full flex flex-col h-full bg-white border-r border-gray-200 shrink-0 shadow-md">
        {/* Header and Search */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50">
          <SearchForm
            searchTerm={searchTerm}
            isSearching={isSearching}
            filterActive={filterType === "active"}
            onSearchTermChange={setSearchTerm}
            onSubmitSearch={handleSearchSubmit}
            onClearSearch={clearSearch}
          />
          <div className="flex gap-2 items-center justify-between">
            <FilterControls
              filterType={filterType}
              activeLayerCount={activeLayerIds.length}
              onFilterTypeChange={onFilterTypeChange}
            />
            {/* Filter Controls */}
            <div className="flex items-center space-x-2 justify-end">
              <Label
                htmlFor="search-method-toggle"
                className="text-xs text-gray-600"
              >
                Geonorge Standard Søk
              </Label>
              <Switch
                id="search-method-toggle"
                checked={searchMethod === "http"}
                onCheckedChange={(checked) =>
                  setSearchMethod(checked ? "http" : "websocket")
                }
                aria-label="Toggle search method between WebSocket and HTTP API"
              />
            </div>
          </div>
        </div>

        {/* Show InitialState during first load */}
        {isInitialLoading ? (
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            <InitialState />
          </div>
        ) : (
          /* Tabs */
          <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-2 mx-4 mt-2 shrink-0 bg-gray-50">
              <TabsTrigger
                value="all"
                className="data-[state=active]:text-color-gn-primary data-[state=active]:border-b-2 data-[state=active]:border-color-gn-primary"
              >
                Alle datasett
              </TabsTrigger>
              <TabsTrigger
                value="recent"
                className="data-[state=active]:text-color-gn-primary data-[state=active]:border-b-2 data-[state=active]:border-color-gn-primary"
              >
                Nylig brukt
              </TabsTrigger>
            </TabsList>

            {/* Tab Content: All Datasets (Search Results) */}
            <TabsContent
              value="all"
              className="flex-1 space-y-1 overflow-y-auto relative"
            >
              <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2 px-4 pt-2">
                <Layers2
                  size={16}
                  className="text-color-gn-primary flex-shrink-0"
                />
                <span className="leading-5">Alle datasett</span>
              </h3>
              {/* Bulk Action Bar positioned absolutely within the TabsContent */}
              <BulkActionBar
                selectedCount={selectedDatasetsInfo.size}
                onClearSelection={clearSelectedDatasets}
                onInitiateDownload={handleBulkDownloadClick}
              />

              <div className="px-4 pb-4 space-y-4">
                {/* Loading/Empty/No Results States */}
                {isSearching ? (
                  <div className="text-center py-8 text-gray-500 flex items-center justify-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin text-color-gn-primary"
                    />
                    <span>Søker...</span>
                  </div>
                ) : displayedResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {filterType === "active" ? (
                      <p>Ingen kjente datasett matcher de aktive kartlagene.</p>
                    ) : !hasSearched ? (
                      <InitialState />
                    ) : (
                      <NoResults />
                    )}
                    <button
                      onClick={() => {
                        if (filterType === "active") {
                          onFilterTypeChange(null);
                        } else {
                          clearSearch();
                        }
                      }}
                      className="text-color-gn-primary hover:underline mt-2"
                    >
                      {filterType === "active"
                        ? "Vis alle søkeresultater"
                        : hasSearched
                        ? "Tilbakestill søk"
                        : ""}
                    </button>
                  </div>
                ) : (
                  // Render Search Results
                  displayedResults.map((searchResult) => {
                    // Ensure UUID exists for key and logic; skip rendering if not (shouldn't happen ideally)
                    if (!searchResult.uuid) {
                      console.warn(
                        "Skipping rendering dataset without UUID:",
                        searchResult
                      );
                      return null;
                    }
                    return (
                      <DatasetItem
                        key={searchResult.uuid}
                        searchResult={searchResult}
                        activeLayerIds={activeLayerIds}
                        isExpanded={expandedCategories.includes(
                          searchResult.uuid!
                        )}
                        isSelected={selectedDatasetsInfo.has(
                          searchResult.uuid!
                        )}
                        onToggleExpand={toggleCategory}
                        onSelectDataset={(dataset: SearchResult) =>
                          handleSelectDataset(dataset)
                        }
                        onDownloadDataset={onDatasetDownload}
                        onToggleLayerRequest={handleLayerToggleRequest}
                      />
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Tab Content: Recently Used */}
            <TabsContent
              value="recent"
              className="flex-1 space-y-1 overflow-y-auto relative"
            >
              {/* Also add the BulkActionBar here if needed */}
              <BulkActionBar
                selectedCount={selectedDatasetsInfo.size}
                onClearSelection={clearSelectedDatasets}
                onInitiateDownload={handleBulkDownloadClick}
              />

              <div className="px-4 pb-4">
                <div className="py-2">
                  <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <Clock size={16} className="text-color-gn-primary" />
                    Nylig brukte datasett
                  </h3>
                  {recentDatasets.length === 0 ? (
                    <div className="text-center py-8 flex flex-col items-center justify-center">
                      <div className="rounded-full bg-gray-100 p-3 mb-4">
                        <Clock className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">
                        Ingen nylig brukte datasett. Aktiver et kartlag for å se
                        det her.
                      </p>
                    </div>
                  ) : (
                    // Render Recent Datasets with proper spacing
                    <div className="space-y-4">
                      {recentDatasets.map((searchResult) => {
                        // Ensure UUID exists for key and logic
                        if (!searchResult.uuid) {
                          console.warn(
                            "Skipping rendering recent dataset without UUID:",
                            searchResult
                          );
                          return null;
                        }
                        return (
                          <DatasetItem
                            key={`recent-${searchResult.uuid}`}
                            searchResult={searchResult}
                            activeLayerIds={activeLayerIds}
                            isExpanded={expandedCategories.includes(
                              searchResult.uuid!
                            )}
                            isSelected={selectedDatasetsInfo.has(
                              searchResult.uuid!
                            )}
                            onToggleExpand={toggleCategory}
                            onSelectDataset={(dataset: SearchResult) =>
                              handleSelectDataset(dataset)
                            }
                            onDownloadDataset={onDatasetDownload}
                            onToggleLayerRequest={handleLayerToggleRequest}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer Section */}
        {activeLayerIds.length > 0 && (
          <div className="p-3 pt-4 border-t border-gray-200 mt-auto shrink-0 bg-gray-50">
            <Button
              variant="outline"
              size="sm"
              onClick={onRemoveAllLayers}
              className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={16} className="mr-2" />
              Fjern alle aktive kartlag ({activeLayerIds.length})
            </Button>
          </div>
        )}

        {/* Dialogs */}
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <BulkDownloadDialog
              open={showDownloadDialog}
              selectedCount={selectedDatasetsInfo.size}
              onOpenChange={setShowDownloadDialog}
              onConfirmDownload={initiateDownloads}
            />
          </div>
        </div>

        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <DuplicateLayerAlertDialog
              open={showDuplicateLayerAlert}
              message={duplicateLayerAlertMessage}
              onOpenChange={setShowDuplicateLayerAlert}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
