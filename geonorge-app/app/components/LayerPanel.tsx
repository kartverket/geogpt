import React, { useMemo } from "react";
import { Star, Clock, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  activeLayerIds,
  onToggleLayer,
  onDatasetDownload,
  filterType,
  onFilterTypeChange,
  // Destructure the new prop
  newlyAddedDatasetInfo,
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

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full flex flex-col h-screen bg-white border-r border-gray-200 shrink-0 shadow-md">
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

        {/* Tabs */}
        <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 mx-4 mt-2 shrink-0 bg-gray-50 border-b border-gray-200">
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
            <TabsTrigger
              value="favorites"
              className="data-[state=active]:text-color-gn-primary data-[state=active]:border-b-2 data-[state=active]:border-color-gn-primary"
            >
              Favoritter
            </TabsTrigger>
          </TabsList>

          {/* Tab Content: All Datasets (Search Results) */}
          <TabsContent
            value="all"
            className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 relative"
          >
            {/* Bulk Action Bar, basically multi download button */}
            <BulkActionBar
              selectedCount={selectedDatasetsInfo.size}
              onClearSelection={clearSelectedDatasets}
              onInitiateDownload={handleBulkDownloadClick}
            />

            {/* Loading/Empty States */}
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
                  <p>Start søk for å finne datasett.</p>
                ) : (
                  <p>Ingen resultater funnet for "{searchTerm}"</p>
                )}
                <button
                  onClick={clearSearch}
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
              // Render Search Results using DatasetItem
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
                    isExpanded={expandedCategories.includes(searchResult.uuid!)}
                    isSelected={selectedDatasetsInfo.has(searchResult.uuid!)}
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
          </TabsContent>

          {/* Tab Content: Recently Used */}
          <TabsContent
            value="recent"
            className="flex-1 overflow-y-auto px-4 pb-4 space-y-1"
          >
            <div className="py-2">
              <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Clock size={16} className="text-color-gn-primary" />
                Nylig brukte datasett
              </h3>
              {recentDatasets.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  Ingen nylig brukte datasett. Aktiver et kartlag for å se det
                  her.
                </div>
              ) : (
                // Render Recent Datasets using DatasetItem
                recentDatasets.map((searchResult) => {
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
                      isSelected={selectedDatasetsInfo.has(searchResult.uuid!)}
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

          {/* Tab Content: Favorites */}
          <TabsContent
            value="favorites"
            className="flex-1 overflow-y-auto px-4 pb-4"
          >
            <div className="py-2">
              <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Star size={16} className="text-amber-400" />
                Favorittdatasett
              </h3>
              <div className="space-y-1">TEST favorites cappas</div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bulk Download Dialog */}
        <BulkDownloadDialog
          open={showDownloadDialog}
          selectedCount={selectedDatasetsInfo.size}
          onOpenChange={setShowDownloadDialog}
          onConfirmDownload={initiateDownloads}
        />

        {/* Duplicate Layer Alert Dialog */}
        <DuplicateLayerAlertDialog
          open={showDuplicateLayerAlert}
          message={duplicateLayerAlertMessage}
          onOpenChange={setShowDuplicateLayerAlert}
        />
      </div>
    </TooltipProvider>
  );
};
