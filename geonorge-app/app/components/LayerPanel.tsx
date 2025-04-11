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
import { cn } from "@/lib/utils";
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
  id: string;
  name: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
}

// Define props for LayerPanel
interface LayerPanelProps {
  activeLayerIds: string[]; // Pass down IDs of layers active on the map
  onToggleLayer: (layerInfo: ActiveLayerInfo, isChecked: boolean) => void; // Handler for toggling layers
  onDatasetDownload: (dataset: SearchResult) => void; // Handler for triggering download
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  activeLayerIds,
  onToggleLayer,
  onDatasetDownload,
}) => {
  const { searchResults, ws } = useWebSocket(); // Get WebSocket instance
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false); // Add searching state
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has been initiated
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null); // Keep filter type for badges
  // State to store all results that have WMS info, keyed by UUID
  const [allWmsResultsMap, setAllWmsResultsMap] = React.useState<
    Map<string, SearchResult>
  >(new Map());

  // State for selected datasets
  const [selectedDatasets, setSelectedDatasets] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedDatasetsInfo, setSelectedDatasetsInfo] = React.useState<
    Map<string, SearchResult>
  >(new Map());
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false); // State for the dialog

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearSearch = () => {
    setSearchTerm("");
    setFilterType(null);
    setHasSearched(false); // Reset search state
    setIsSearching(false); // Ensure loading state is also reset
    // Optionally, send a message to reset results on the backend or clear local results
    // if (ws && ws.readyState === WebSocket.OPEN) {
    //   ws.send(JSON.stringify({ action: "clearSearchResults" }));
    // }
  };

  // Select/deselect dataset
  const handleSelectDataset = (dataset: SearchResult) => {
    // Ensure dataset and uuid exist
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
        // Store the dataset info
        setSelectedDatasetsInfo((prevInfo) => {
          const newMap = new Map(prevInfo);
          newMap.set(dataset.uuid, dataset);
          return newMap;
        });
      }
      return newSet;
    });
  };

  // Clear selected datasets
  const clearSelectedDatasets = () => {
    setSelectedDatasets(new Set());
    setSelectedDatasetsInfo(new Map());
  };

  // Handle bulk download click - Now just opens the dialog
  const handleBulkDownloadClick = () => {
    if (selectedDatasetsInfo.size > 0) {
      setShowDownloadDialog(true);
    }
  };

  // Function to initiate downloads after dialog confirmation
  const initiateDownloads = () => {
    console.log("Initiating bulk download for:", selectedDatasetsInfo);
    if (!onDatasetDownload) {
      console.error("onDatasetDownload prop is not provided to LayerPanel.");
      setShowDownloadDialog(false); // Close dialog even on error
      return;
    }
    selectedDatasetsInfo.forEach((dataset) => {
      onDatasetDownload(dataset); // Trigger download for each selected dataset
    });
    setShowDownloadDialog(false); // Close the dialog
    // Optionally clear selection after initiating downloads
    clearSelectedDatasets();
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[LayerPanel] handleSearchSubmit triggered."); // Log trigger
    console.log("[LayerPanel] ws object:", ws); // Log ws object
    console.log("[LayerPanel] searchTerm:", searchTerm); // Log search term

    if (ws) {
      console.log("[LayerPanel] ws.readyState:", ws.readyState); // Log readyState if ws exists
    }

    // Add specific logs for each condition
    if (!ws) {
      console.log("[LayerPanel] WS send prevented: ws is null or undefined.");
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(
        `[LayerPanel] WS send prevented: ws.readyState is ${ws.readyState} (Expected: ${WebSocket.OPEN}).`
      );
      return;
    }
    if (!searchTerm.trim()) {
      console.log(
        "[LayerPanel] WS send prevented: searchTerm is empty or whitespace."
      );
      return;
    }

    console.log(
      "[LayerPanel] Conditions met. Sending search request:",
      searchTerm
    );
    setIsSearching(true);
    setHasSearched(true); // Mark that a search has been performed
    ws.send(
      JSON.stringify({
        action: "searchFormSubmit", // Use the same action as KartkatalogTab for consistency? Or a new one?
        payload: searchTerm,
      })
    );
    // Clear filterType when performing a new search
    setFilterType(null);
  };

  // Effect to handle incoming search results and reset loading state
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
            setIsSearching(false); // Stop loading indicator

            // Update the map of all known WMS results
            setAllWmsResultsMap((prevMap) => {
              const newMap = new Map(prevMap);
              newResults.forEach((result) => {
                // Store only results with WMS capabilities and a UUID
                if (result.uuid && result.wmsUrl) {
                  newMap.set(result.uuid, result);
                }
              });
              return newMap;
            });

            // Optionally automatically expand results - uncomment if needed
            // const resultUuids = newResults.map((r) => r.uuid).filter(Boolean);
            // setExpandedCategories(prev => [...new Set([...prev, ...resultUuids])]);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          setIsSearching(false); // Stop loading on error too
        }
      };

      ws.addEventListener("message", handleMessage);

      return () => {
        ws.removeEventListener("message", handleMessage);
      };
    } else {
      setIsSearching(false); // Ensure loading is false if ws is not available
    }
  }, [ws]); // Removed allWmsResultsMap dependency - it's updated internally

  // Determine which results to display based on search, filters, and active layers
  const displayedResults = useMemo(() => {
    const currentSearchResults = searchResults || [];

    if (filterType === "active") {
      const allKnownWmsResults = Array.from(allWmsResultsMap.values());
      // Filter all known results that have any active layer
      return allKnownWmsResults.filter((result) => {
        const wmsInfo = result.wmsUrl;
        if (!wmsInfo || !wmsInfo.available_layers || !wmsInfo.wms_url) {
          return false; // Cannot be active if no WMS layers/url
        }
        return wmsInfo.available_layers.some((layer) => {
          const layerId = `${wmsInfo.wms_url}-${layer.name}`;
          return activeLayerIds.includes(layerId);
        });
      });
    }

    // TODO: Implement other filters like 'popular' here, filtering 'currentSearchResults'
    // if (filterType === 'popular') { ... }

    // Default: return the latest search results if no specific filter is active
    return currentSearchResults;
  }, [searchResults, filterType, activeLayerIds, allWmsResultsMap]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full flex flex-col h-screen bg-white border-r border-geo-lightGray shrink-0">
        <div className="p-4 border-b border-geo-lightGray">
          {/* <h2 className="text-lg font-semibold text-geo-darkGray mb-3">
            Kartkatalog
          </h2> */}
          <form onSubmit={handleSearchSubmit} className="relative mb-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Søk etter datasett..."
              className="pl-9 bg-geo-slate border"
              disabled={isSearching} // Disable input while searching
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 text-geo-textGray hover:text-geo-darkGray disabled:opacity-50"
              aria-label="Submit search"
              disabled={isSearching || !searchTerm.trim()} // Disable if searching or input is empty
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
                setFilterType(filterType === "active" ? null : "active")
              }
            >
              <Eye size={14} className="mr-1" /> Aktive lag (
              {activeLayerIds.length})
            </Badge>
            <Badge
              variant={filterType === "popular" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                setFilterType(filterType === "popular" ? null : "popular")
              }
            >
              <Star size={14} className="mr-1" /> Populære
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
          {" "}
          {/* Added min-h-0 for flex child scrolling */}
          <TabsList className="grid grid-cols-3 mx-4 mt-2 shrink-0">
            {" "}
            {/* Added shrink-0 */}
            <TabsTrigger value="all">Alle datasett</TabsTrigger>
            <TabsTrigger value="recent">Nylig brukt</TabsTrigger>
            <TabsTrigger value="favorites">Favoritter</TabsTrigger>
          </TabsList>
          <TabsContent
            value="all"
            className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 relative"
          >
            {/* Selected datasets (multiple-dataset-selection) for bulk download */}
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

            {isSearching ? (
              <div className="text-center py-8 text-geo-textGray flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Søker...</span>
              </div>
            ) : displayedResults.length === 0 ? ( // Check displayedResults length
              // Show appropriate message based on context
              <div className="text-center py-8 text-geo-textGray">
                {filterType === "active" ? (
                  // Message when 'Active' filter is on but finds nothing
                  <p>Ingen kjente datasett matcher de aktive kartlagene.</p>
                ) : !hasSearched ? (
                  // Initial message before any search
                  <p>Start søk for å finne datasett.</p>
                ) : (
                  // Message when search yields no results
                  <p>Ingen resultater funnet for "{searchTerm}"</p>
                )}
                <button
                  onClick={clearSearch} // clearSearch clears filters too
                  className="text-geo-blue hover:underline mt-2"
                >
                  {filterType === "active"
                    ? "Vis alle søkeresultater" // Or "Tilbakestill filter"
                    : hasSearched
                    ? "Tilbakestill søk"
                    : ""}
                </button>
              </div>
            ) : (
              // Render the list using displayedResults
              displayedResults.map((searchResult) => {
                // Map over displayedResults
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
                        <div className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div
                        className="flex items-center justify-between cursor-pointer group mb-1"
                        onClick={() =>
                          searchResult.uuid && toggleCategory(searchResult.uuid)
                        }
                      >
                        <div className="flex items-center gap-2 overflow-hidden max-w-[275px]">
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
                                    console.log(
                                      "[LayerPanel] Download clicked for:",
                                      searchResult
                                    );
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

                      {searchResult.uuid &&
                        expandedCategories.includes(searchResult.uuid) &&
                        searchResult.wmsUrl?.available_layers && (
                          <div className="space-y-1 mt-1 mb-2 animate-slide-up max-h-60 overflow-y-auto pr-1">
                            {searchResult.wmsUrl.available_layers.length > 0 ? (
                              searchResult.wmsUrl.available_layers.map(
                                (layer: WMSLayer) => {
                                  const sourceUrl =
                                    searchResult.wmsUrl?.wms_url;
                                  if (!sourceUrl) return null;

                                  const layerId = `${sourceUrl}-${layer.name}`;
                                  const isChecked =
                                    activeLayerIds.includes(layerId);

                                  return (
                                    <div
                                      key={layerId}
                                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-geo-slate/50 rounded-md"
                                    >
                                      <Checkbox
                                        id={layerId}
                                        checked={isChecked}
                                        onCheckedChange={(checkedState) => {
                                          const layerInfo: ActiveLayerInfo = {
                                            id: layerId,
                                            name: layer.name,
                                            title: layer.title || layer.name,
                                            sourceUrl: sourceUrl,
                                            sourceTitle:
                                              searchResult.title ||
                                              "Ukjent Kilde",
                                          };
                                          onToggleLayer(
                                            layerInfo,
                                            !!checkedState
                                          );
                                        }}
                                      />
                                      <label
                                        htmlFor={layerId}
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
                    key={layer.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-geo-slate/50 rounded-md"
                  >
                    <Checkbox
                      id={`recent-${layer.id}`}
                      checked={activeLayerIds.includes(layer.id)}
                      onCheckedChange={(checkedState) => {
                        const categoryLabel =
                          mockLayers.find((c) => c.id === layer.categoryId)
                            ?.label || "Ukjent Kategori";
                        const layerInfo: ActiveLayerInfo = {
                          id: layer.id,
                          name: layer.label,
                          title: layer.label,
                          sourceUrl: "",
                          sourceTitle: categoryLabel,
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
                    key={layer.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-geo-slate/50 rounded-md"
                  >
                    <Checkbox
                      id={`fav-${layer.id}`}
                      checked={activeLayerIds.includes(layer.id)}
                      onCheckedChange={(checkedState) => {
                        const categoryLabel =
                          mockLayers.find((c) => c.id === layer.categoryId)
                            ?.label || "Ukjent Kategori";
                        const layerInfo: ActiveLayerInfo = {
                          id: layer.id,
                          name: layer.label,
                          title: layer.label,
                          sourceUrl: "",
                          sourceTitle: categoryLabel,
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
                {/* You might adjust this text depending on how executeDatasetDownload behaves */}
                {/* For example: "Detaljer for hvert datasett vil vises." */}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-omar border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
                Avbryt
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={initiateDownloads} // Call initiateDownloads on confirm
                className="rounded-omar bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Start nedlasting
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
