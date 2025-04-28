import React, { useState, useEffect, FormEvent, useMemo } from "react";
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Star,
  Clock,
  Eye,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebSocket } from "./chat_components/useWebSocket";
import { WMSLayer, SearchResult } from "./chat_components/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LayerItem {
  id: string;
  label: string;
  popular?: boolean;
}

interface LayerCategory {
  id: string;
  label: string;
  items: LayerItem[];
}

interface SimpleLayer {
  id: string;
  label: string;
  categoryId: string;
}

// More realistic dataset structure with nested categories
const mockLayers: LayerCategory[] = [
  {
    id: "administrative",
    label: "Administrative grenser",
    items: [
      { id: "kommuner", label: "Kommuner", popular: true },
      { id: "fylker", label: "Fylker", popular: true },
      { id: "grunnkretser", label: "Grunnkretser" },
      { id: "postnummeromrader", label: "Postnummerområder" },
      { id: "valgkretser", label: "Valgkretser" },
    ],
  },
  {
    id: "basis",
    label: "Basis geodata",
    items: [
      { id: "hoydekurver", label: "Høydekurver", popular: true },
      { id: "vannflate", label: "Vannflate", popular: true },
      { id: "vannlinje", label: "Vannlinje" },
      { id: "bygg", label: "Bygninger" },
      { id: "veier", label: "Veier", popular: true },
      { id: "jernbane", label: "Jernbane" },
      { id: "lufthavn", label: "Lufthavn" },
    ],
  },
  {
    id: "naturfare",
    label: "Naturfare",
    items: [
      {
        id: "kvikkleireKartlagtOmrade",
        label: "Kvikkleire Kartlagt Område",
        popular: true,
      },
      { id: "kvikkleireRisiko", label: "Kvikkleire Risiko", popular: true },
      { id: "kvikkleireFaregrad", label: "Kvikkleire Faregrad", popular: true },
      { id: "flomaktsomhet", label: "Flom aktsomhet" },
      { id: "snoaktsomhet", label: "Snøskred aktsomhet" },
      { id: "jordskredaktsomhet", label: "Jordskred aktsomhet" },
      { id: "steinsprangaktsomhet", label: "Steinsprang aktsomhet" },
      { id: "fjellskredaktsomhet", label: "Fjellskred aktsomhet" },
    ],
  },
  {
    id: "samferdsel",
    label: "Samferdsel",
    items: Array(15)
      .fill(0)
      .map((_, i) => ({
        id: `samferdsel-${i}`,
        label: `Samferdsel type ${i + 1}`,
      })),
  },
  {
    id: "energi",
    label: "Energiressurser",
    items: Array(12)
      .fill(0)
      .map((_, i) => ({ id: `energi-${i}`, label: `Energiressurs ${i + 1}` })),
  },
  {
    id: "miljo",
    label: "Miljø og klima",
    items: Array(18)
      .fill(0)
      .map((_, i) => ({ id: `miljo-${i}`, label: `Miljødata ${i + 1}` })),
  },
];

// Simulated recently used and favorite layers
const recentlyUsedLayers: SimpleLayer[] = [
  {
    id: "kvikkleireRisiko",
    label: "Kvikkleire Risiko",
    categoryId: "naturfare",
  },
  { id: "kommuner", label: "Kommuner", categoryId: "administrative" },
  { id: "veier", label: "Veier", categoryId: "basis" },
  { id: "hoydekurver", label: "Høydekurver", categoryId: "basis" },
];

const favoriteLayers: SimpleLayer[] = [
  {
    id: "kvikkleireFaregrad",
    label: "Kvikkleire Faregrad",
    categoryId: "naturfare",
  },
  { id: "flomaktsomhet", label: "Flom aktsomhet", categoryId: "naturfare" },
  { id: "kommuner", label: "Kommuner", categoryId: "administrative" },
];

// Interface for the layer information passed up
export interface ActiveLayerInfo {
  id: string; // Unique ID: `${sourceUuid}-${layer.name}`
  name: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceUuid: string;
}

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [allWmsResultsMap, setAllWmsResultsMap] = React.useState<
    Map<string, SearchResult>
  >(new Map());
  const [selectedDatasets, setSelectedDatasets] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedDatasetsInfo, setSelectedDatasetsInfo] = React.useState<
    Map<string, SearchResult>
  >(new Map());
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  // State for duplicate layer alert
  const [showDuplicateLayerAlert, setShowDuplicateLayerAlert] =
    React.useState(false);
  const [duplicateLayerAlertMessage, setDuplicateLayerAlertMessage] =
    React.useState("");

  // Effect to update internal map when a dataset is added externally
  useEffect(() => {
    if (newlyAddedDatasetInfo && newlyAddedDatasetInfo.uuid) {
      setAllWmsResultsMap((prevMap) => {
        // Only add if it's not already known
        if (!prevMap.has(newlyAddedDatasetInfo.uuid)) {
          const newMap = new Map(prevMap);
          newMap.set(newlyAddedDatasetInfo.uuid, newlyAddedDatasetInfo);
          console.log(
            "[LayerPanel] Ensuring dataset from external source is known:",
            newlyAddedDatasetInfo.title
          );

          setExpandedCategories((prevExpanded) => {
            if (!prevExpanded.includes(newlyAddedDatasetInfo.uuid)) {
              return [...prevExpanded, newlyAddedDatasetInfo.uuid];
            }
            return prevExpanded;
          });

          return newMap;
        }
        return prevMap; // Dataset already known, no state change needed
      });
      // Potential Improvement: Could add a callback prop here to signal
      // to the parent (DemoV4) that the info has been processed, allowing
      // the parent to reset newlyAddedDatasetInfo to null. For now, this works.
    }
  }, [newlyAddedDatasetInfo]); // Dependency array includes the new prop

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearSearch = () => {
    setSearchTerm("");
    onFilterTypeChange(null);
    setHasSearched(false);
    setIsSearching(false);
    // Clear search results from the hook state if desired
    // (Assuming useWebSocket hook provides a way to clear/reset its state)
    // clearWebSocketResults(); // Placeholder for actual function
  };

  const handleSelectDataset = (dataset: SearchResult) => {
    if (!dataset || !dataset.uuid) {
      console.warn("Attempted to select a dataset without a UUID:", dataset);
      return;
    }
    setSelectedDatasets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataset.uuid)) {
        newSet.delete(dataset.uuid);
        setSelectedDatasetsInfo((prevInfo) => {
          const newMap = new Map(prevInfo);
          newMap.delete(dataset.uuid);
          return newMap;
        });
      } else {
        newSet.add(dataset.uuid);
        setSelectedDatasetsInfo((prevInfo) => {
          const newMap = new Map(prevInfo);
          newMap.set(dataset.uuid, dataset);
          return newMap;
        });
      }
      return newSet;
    });
  };

  const clearSelectedDatasets = () => {
    setSelectedDatasets(new Set());
    setSelectedDatasetsInfo(new Map());
  };

  const handleBulkDownloadClick = () => {
    if (selectedDatasetsInfo.size > 0) {
      setShowDownloadDialog(true);
    }
  };

  const initiateDownloads = async () => {
    console.log("Initiating bulk download for:", selectedDatasetsInfo);
    const downloadLinks: HTMLAnchorElement[] = [];

    selectedDatasetsInfo.forEach((dataset) => {
      // Assuming dataset object has a downloadUrl property similar to kartkatalog-tab
      if (dataset.downloadUrl) {
        console.log(
          `Creating download link for ${dataset.title || dataset.uuid} at ${
            dataset.downloadUrl
          }`
        );
        const link = document.createElement("a");
        link.href = dataset.downloadUrl;
        link.setAttribute("download", ""); // Suggest a filename if available, otherwise browser decides
        link.setAttribute("target", "_blank"); // Helps in some browser contexts
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
    // Click links sequentially with a small delay
    for (const link of downloadLinks) {
      link.click();
      // Small delay between clicks might help avoid browser blocking
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Cleanup: Remove links after a delay to ensure download starts
    setTimeout(() => {
      console.log(`Cleaning up ${downloadLinks.length} download links.`);
      downloadLinks.forEach((link) => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      });
    }, 1000); // Increased delay for cleanup

    setShowDownloadDialog(false);
    clearSelectedDatasets();
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN || !searchTerm.trim()) {
      console.warn(
        "[LayerPanel] WS send prevented due to state or empty term."
      );
      return;
    }
    console.log(
      "[LayerPanel] Conditions met. Sending search request:",
      searchTerm
    );
    setIsSearching(true);
    setHasSearched(true);
    ws.send(
      JSON.stringify({
        action: "searchFormSubmit",
        payload: searchTerm,
      })
    );
  };

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
            console.log("Received search results from WebSocket:", newResults);
            setIsSearching(false);

            setAllWmsResultsMap((prevMap) => {
              const newMap = new Map(prevMap);
              newResults.forEach((result) => {
                if (result.uuid && result.wmsUrl) {
                  newMap.set(result.uuid, result);
                }
              });
              return newMap;
            });
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          setIsSearching(false);
        }
      };

      ws.addEventListener("message", handleMessage);

      return () => {
        ws.removeEventListener("message", handleMessage);
      };
    } else {
      setIsSearching(false);
    }
  }, [ws]);

  const displayedResults = useMemo(() => {
    const currentSearchResults = searchResults || [];

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
  }, [searchResults, filterType, activeLayerIds, allWmsResultsMap]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full flex flex-col h-screen bg-white border-r border-geo-lightGray shrink-0">
        {/* Header and Search */}
        <div className="p-4 border-b border-geo-lightGray">
          <form onSubmit={handleSearchSubmit} className="relative mb-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Søk etter datasett..."
              className="pl-9 bg-geo-slate border"
              disabled={isSearching}
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 text-geo-textGray hover:text-geo-darkGray disabled:opacity-50"
              aria-label="Submit search"
              disabled={isSearching || !searchTerm.trim()}
            >
              <Search size={16} />
            </button>
            {(searchTerm || filterType) && !isSearching && (
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                onClick={clearSearch}
                aria-label="Clear search and filters"
              >
                <X size={16} className="text-geo-textGray" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 size={16} className="text-geo-textGray animate-spin" />
              </div>
            )}
          </form>
          {/* Quick filters */}
          <div className="flex gap-2 my-2 flex-wrap">
            <Badge
              variant={filterType === "active" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                onFilterTypeChange(filterType === "active" ? null : "active")
              }
            >
              <Eye size={14} className="mr-1" /> Aktive lag (
              {activeLayerIds.length})
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 mx-4 mt-2 shrink-0">
            <TabsTrigger value="all">Alle datasett</TabsTrigger>
            <TabsTrigger value="recent">Nylig brukt</TabsTrigger>
            <TabsTrigger value="favorites">Favoritter</TabsTrigger>
          </TabsList>

          {/* Tab Content: All Datasets (Search Results) */}
          <TabsContent
            value="all"
            className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 relative"
          >
            {/* Bulk Download Bar */}
            {selectedDatasets.size > 0 && (
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center shadow-sm mb-2">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={clearSelectedDatasets}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white text-gray-800 shadow-lg">
                      <p>Fjern valg</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedDatasets.size} valgt
                  </span>
                </div>
                <Button
                  onClick={handleBulkDownloadClick}
                  size="sm"
                  className="px-3 py-1.5 text-sm border shadow-sm bg-black hover:bg-black/80 rounded-md transition-all flex items-center gap-1"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Last ned valgte
                </Button>
              </div>
            )}

            {/* Loading/Empty States */}
            {isSearching ? (
              <div className="text-center py-8 text-geo-textGray flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Søker...</span>
              </div>
            ) : displayedResults.length === 0 ? (
              <div className="text-center py-8 text-geo-textGray">
                {filterType === "active" ? (
                  <p>Ingen kjente datasett matcher de aktive kartlagene.</p>
                ) : !hasSearched ? (
                  <p>Start søk for å finne datasett.</p>
                ) : (
                  <p>Ingen resultater funnet for "{searchTerm}"</p>
                )}
                <button
                  onClick={clearSearch}
                  className="text-geo-blue hover:underline mt-2"
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
                const resultKey =
                  searchResult.uuid ||
                  searchResult.title ||
                  Math.random().toString();
                const canDownload = !!searchResult.downloadUrl;

                return (
                  <div
                    key={resultKey}
                    className="border-b border-geo-lightGray last:border-b-0 py-2 flex items-start gap-3"
                  >
                    {/* Download Checkbox */}
                    <div className="pt-1">
                      {canDownload ? (
                        <Checkbox
                          id={`select-${resultKey}`}
                          checked={selectedDatasets.has(searchResult.uuid)}
                          onCheckedChange={() =>
                            handleSelectDataset(searchResult)
                          }
                          aria-label={`Select dataset ${
                            searchResult.title || "Ukjent Tittel"
                          }`}
                        />
                      ) : (
                        <div className="w-4 h-4" /> /* Placeholder */
                      )}
                    </div>

                    {/* Dataset Info & Layers */}
                    <div className="flex-1">
                      {/* Title Row */}
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-1"
                        onClick={() =>
                          searchResult.uuid && toggleCategory(searchResult.uuid)
                        }
                      >
                        <div className="flex items-center gap-2 overflow-hidden max-w-[250px]">
                          <span className="text-sm font-medium text-geo-darkGray truncate group-hover:text-geo-blue">
                            {searchResult.title || "Ukjent Tittel"}
                          </span>
                          {searchResult.wmsUrl?.available_layers && (
                            <Badge variant="outline" className="shrink-0">
                              {searchResult.wmsUrl.available_layers.length} lag
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canDownload && onDatasetDownload && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-geo-textGray hover:text-geo-blue"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDatasetDownload(searchResult);
                                  }}
                                >
                                  <Download size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-white text-gray-800 shadow-lg">
                                <p>Last ned</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Expand/Collapse Icon */}
                          <div className="text-geo-textGray p-1">
                            {searchResult.uuid &&
                            expandedCategories.includes(searchResult.uuid) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* WMS Layer List (Collapsible) */}
                      {searchResult.uuid &&
                        expandedCategories.includes(searchResult.uuid) &&
                        searchResult.wmsUrl?.available_layers && (
                          <div className="space-y-1 mt-1 mb-2 animate-slide-up max-h-60 overflow-y-auto pr-1">
                            {searchResult.wmsUrl.available_layers.length > 0 ? (
                              searchResult.wmsUrl.available_layers.map(
                                (layer: WMSLayer) => {
                                  const sourceUrl =
                                    searchResult.wmsUrl?.wms_url;
                                  // Need both URL and UUID for logic
                                  if (!sourceUrl || !searchResult.uuid) {
                                    return null;
                                  }

                                  const uniqueLayerId = `${searchResult.uuid}-${layer.name}`;
                                  const isChecked =
                                    activeLayerIds.includes(uniqueLayerId);

                                  return (
                                    <div
                                      key={uniqueLayerId}
                                      className="flex items-center gap-2 px-0 py-1.5 hover:bg-geo-slate/50 rounded-md"
                                    >
                                      <Checkbox
                                        id={uniqueLayerId}
                                        checked={isChecked}
                                        onCheckedChange={(checkedState) => {
                                          // --- Start Duplicate Check Logic (only if activating) ---
                                          if (checkedState === true) {
                                            const targetSourceUrl =
                                              searchResult.wmsUrl?.wms_url;
                                            const targetLayerName = layer.name;
                                            const targetLayerTitle =
                                              layer.title || layer.name;

                                            if (
                                              !targetSourceUrl ||
                                              !searchResult.uuid
                                            ) {
                                              console.error(
                                                "Missing info for duplicate check"
                                              );
                                              return;
                                            }

                                            let isDuplicateWmsLayer = false;
                                            let existingDatasetTitle = "";

                                            // Check against currently active layers
                                            console.log(
                                              `[Duplicate Check] Starting for Target: Layer='${targetLayerName}', URL='${targetSourceUrl}', From UUID='${searchResult.uuid}'`
                                            );
                                            for (const activeId of activeLayerIds) {
                                              console.log(
                                                `-- Checking Active ID: ${activeId} --`
                                              );

                                              // Match UUID pattern (8-4-4-4-12 hex chars) at the start, then capture the rest after '-'
                                              const uuidPattern =
                                                /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.*)$/i;
                                              const parts =
                                                activeId.match(uuidPattern);

                                              if (!parts || parts.length < 3) {
                                                console.log(
                                                  `   Skipping activeId (UUID pattern parse fail): ${activeId}`
                                                );
                                                continue;
                                              }

                                              const activeSourceUuid = parts[1]; // Full UUID
                                              const activeLayerName = parts[2]; // Layer name after the UUID and hyphen
                                              console.log(
                                                `   Active Parsed: UUID=${activeSourceUuid}, Layer=${activeLayerName}`
                                              );

                                              // Skip if it's the same layer from the *same* dataset
                                              if (
                                                activeSourceUuid ===
                                                searchResult.uuid
                                              ) {
                                                console.log(
                                                  `   Skipping: Same dataset UUID (${activeSourceUuid})`
                                                );
                                                continue;
                                              }

                                              const activeSearchResult =
                                                allWmsResultsMap.get(
                                                  activeSourceUuid
                                                );
                                              console.log(
                                                `   Found active SearchResult in Map:`,
                                                activeSearchResult
                                                  ? "Yes"
                                                  : "No",
                                                activeSearchResult?.title
                                              );
                                              const activeSourceUrl =
                                                activeSearchResult?.wmsUrl
                                                  ?.wms_url;
                                              console.log(
                                                `   Active URL from Map: ${activeSourceUrl}`
                                              );

                                              // Check for match: same URL and same layer name
                                              const urlsMatch =
                                                activeSourceUrl ===
                                                targetSourceUrl;
                                              const namesMatch =
                                                activeLayerName ===
                                                targetLayerName;
                                              console.log(
                                                `   URLs Match: ${urlsMatch} ('${activeSourceUrl}' vs '${targetSourceUrl}')`
                                              );
                                              console.log(
                                                `   Names Match: ${namesMatch} ('${activeLayerName}' vs '${targetLayerName}')`
                                              );

                                              if (urlsMatch && namesMatch) {
                                                console.log(
                                                  `   ** DUPLICATE DETECTED **`
                                                );
                                                isDuplicateWmsLayer = true;
                                                existingDatasetTitle =
                                                  activeSearchResult?.title ||
                                                  "et annet datasett";
                                                break; // Found a duplicate, no need to check further
                                              }
                                            }
                                            console.log(
                                              `[Duplicate Check] Finished. isDuplicateWmsLayer: ${isDuplicateWmsLayer}`
                                            );

                                            // If a duplicate is found, show alert and stop
                                            if (isDuplicateWmsLayer) {
                                              console.log(
                                                `[Duplicate Check] Showing alert.`
                                              );
                                              setDuplicateLayerAlertMessage(
                                                `Laget "${targetLayerTitle}" fra denne WMS-tjenesten er allerede aktivt via datasettet "${existingDatasetTitle}". Du kan kun ha én forekomst av dette kartlaget aktivt om gangen.`
                                              );
                                              setShowDuplicateLayerAlert(true);
                                              return; // <<< PREVENT TOGGLING
                                            }
                                          }
                                          // --- End Duplicate Check Logic ---

                                          // --- Proceed with Toggle ---
                                          const layerInfo: ActiveLayerInfo = {
                                            id: uniqueLayerId,
                                            name: layer.name,
                                            title: layer.title || layer.name,
                                            sourceUrl: sourceUrl, // Relies on check above
                                            sourceTitle:
                                              searchResult.title ||
                                              "Ukjent Kilde",
                                            sourceUuid: searchResult.uuid,
                                          };
                                          onToggleLayer(
                                            layerInfo,
                                            !!checkedState
                                          );
                                        }}
                                      />
                                      <label
                                        htmlFor={uniqueLayerId}
                                        className="flex-1 text-sm text-geo-textGray cursor-pointer"
                                      >
                                        {layer.title || layer.name}
                                      </label>
                                    </div>
                                  );
                                }
                              )
                            ) : (
                              <div className="px-2 py-1.5 text-xs text-geo-textGray italic">
                                Ingen kartlag funnet for denne WMS-tjenesten.
                              </div>
                            )}
                          </div>
                        )}
                      {/* Message if WMS details are not available */}
                      {searchResult.uuid &&
                        expandedCategories.includes(searchResult.uuid) &&
                        !searchResult.wmsUrl?.available_layers && (
                          <div className="ml-4 pl-2 border-l border-geo-lightGray mt-1 mb-2 px-2 py-1.5 text-xs text-geo-textGray italic">
                            WMS detaljer (kartlag) ikke tilgjengelig.
                          </div>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Tab Content: Recently Used */}
          <TabsContent
            value="recent"
            className="flex-1 overflow-y-auto px-4 pb-4"
          >
            <div className="py-2">
              <h3 className="text-sm font-medium text-geo-darkGray mb-2 flex items-center gap-2">
                <Clock size={16} />
                Nylig brukte datasett
              </h3>
              <div className="space-y-1">
                {recentlyUsedLayers.map((layer) => (
                  <div
                    key={`recent-${layer.id}`} // Ensure unique key
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-geo-slate/50 rounded-md"
                  >
                    <Checkbox
                      id={`recent-${layer.id}`}
                      // This check might need adjustment if IDs aren't unique across sources
                      checked={activeLayerIds.includes(layer.id)}
                      onCheckedChange={(checkedState) => {
                        // TODO: Implement proper duplicate check for mock data if needed
                        const categoryLabel =
                          mockLayers.find((c) => c.id === layer.categoryId)
                            ?.label || "Ukjent Kategori";
                        const layerInfo: ActiveLayerInfo = {
                          id: layer.id, // Using mock ID
                          name: layer.label,
                          title: layer.label,
                          sourceUrl: "", // Mock data has no URL
                          sourceTitle: categoryLabel,
                          sourceUuid: `mock-${layer.categoryId}`, // Placeholder UUID
                        };
                        onToggleLayer(layerInfo, !!checkedState);
                      }}
                    />
                    <label
                      htmlFor={`recent-${layer.id}`}
                      className="flex-1 text-sm text-geo-textGray cursor-pointer"
                    >
                      {layer.label}
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {mockLayers.find((c) => c.id === layer.categoryId)?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab Content: Favorites */}
          <TabsContent
            value="favorites"
            className="flex-1 overflow-y-auto px-4 pb-4"
          >
            <div className="py-2">
              <h3 className="text-sm font-medium text-geo-darkGray mb-2 flex items-center gap-2">
                <Star size={16} className="text-amber-400" />
                Favorittdatasett
              </h3>
              <div className="space-y-1">
                {favoriteLayers.map((layer) => (
                  <div
                    key={`fav-${layer.id}`} // Ensure unique key
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-geo-slate/50 rounded-md"
                  >
                    <Checkbox
                      id={`fav-${layer.id}`}
                      // This check might need adjustment
                      checked={activeLayerIds.includes(layer.id)}
                      onCheckedChange={(checkedState) => {
                        // TODO: Implement proper duplicate check for mock data if needed
                        const categoryLabel =
                          mockLayers.find((c) => c.id === layer.categoryId)
                            ?.label || "Ukjent Kategori";
                        const layerInfo: ActiveLayerInfo = {
                          id: layer.id, // Using mock ID
                          name: layer.label,
                          title: layer.label,
                          sourceUrl: "", // Mock data has no URL
                          sourceTitle: categoryLabel,
                          sourceUuid: `mock-${layer.categoryId}`, // Placeholder UUID
                        };
                        onToggleLayer(layerInfo, !!checkedState);
                      }}
                    />
                    <label
                      htmlFor={`fav-${layer.id}`}
                      className="flex-1 text-sm text-geo-textGray cursor-pointer"
                    >
                      {layer.label}
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {mockLayers.find((c) => c.id === layer.categoryId)?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bulk Download Confirmation Dialog */}
        <AlertDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
        >
          <AlertDialogContent className="bg-white rounded-omar border border-gray-200 shadow-lg max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl flex items-center">
                Last ned {selectedDatasets.size} datasett
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                Nedlastingsprosessen vil starte for alle valgte datasett.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-omar border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
                Avbryt
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={initiateDownloads}
                className="rounded-omar bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Start nedlasting
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Duplicate WMS Layer Alert Dialog */}
        <AlertDialog
          open={showDuplicateLayerAlert}
          onOpenChange={setShowDuplicateLayerAlert}
        >
          <AlertDialogContent className="bg-white rounded-omar border border-gray-200 shadow-lg max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl flex items-center text-yellow-700">
                {/* <AlertTriangle className="h-5 w-5 mr-2" /> */}
                Duplisert Kartlag Funnet
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                {duplicateLayerAlertMessage}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => setShowDuplicateLayerAlert(false)}
                className="rounded-omar bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                Ok, forstått
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
