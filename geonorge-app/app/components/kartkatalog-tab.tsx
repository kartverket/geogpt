"use client";

import * as React from "react";

// Icons
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  Library,
  Eye,
  XCircle,
  LockKeyhole,
  Download,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Trash2,
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useWebSocket } from "./chat_components";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import { useTour } from "@/components/tour";

export interface KartkatalogTabHandle {
  search: (query: string) => void;
  clearSelectedDatasets: () => void;
}

interface SearchResult {
  uuid: string;
  title?: string;
  description?: string;
  wmsUrl?: string;
  downloadUrl?: string | null;
  restricted?: boolean;
  selected?: boolean;
  fetchedDescription?: string;
  isLoadingDescription?: boolean;
}

interface KartkatalogTabProps {
  className?: string;
  onReplaceIframe: (wmsUrl: string) => void;
  onDatasetDownload: (dataset: SearchResult) => void;
  ws: WebSocket | null;
}

export const KartkatalogTab = React.forwardRef<
  KartkatalogTabHandle,
  KartkatalogTabProps
>(({ className, onReplaceIframe, onDatasetDownload, ws }, ref) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [searchInput, setSearchInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [localSearchResults, setLocalSearchResults] = React.useState<
    SearchResult[]
  >([]);
  const [selectedDatasets, setSelectedDatasets] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedDatasetsInfo, setSelectedDatasetsInfo] = React.useState<
    Map<string, SearchResult>
  >(new Map());
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [descriptionsCache, setDescriptionsCache] = React.useState<
    Map<string, string>
  >(new Map());
  const [openHoverCardId, setOpenHoverCardId] = React.useState<string | null>(
    null
  );

  // Create a ref for the main panel container
  const panelRef = React.useRef<HTMLDivElement>(null);

  const { currentStep, isTourCompleted, isActive } = useTour();
  React.useEffect(() => {
    if (isActive) {
      if (!isActive) {
        setIsExpanded(false);
      }
    }
    if (isTourCompleted) {
      setIsExpanded(false);
    }
  }, [currentStep, isTourCompleted]);

  // Use client-side only import for Leaflet
  React.useEffect(() => {
    if (typeof window === "undefined" || !panelRef.current) return;

    // Import Leaflet dynamically
    import("leaflet").then((L) => {
      // This will prevent the scroll (wheel) events on the panel from propagating to the map.
      L.DomEvent.disableScrollPropagation(panelRef.current!);
    });
  }, []);

  const { searchResults: contextSearchResults } = useWebSocket();

  // Use useMemo to stabilize the reference to searchResults
  const searchResults = React.useMemo(() => {
    return localSearchResults.length > 0
      ? localSearchResults
      : contextSearchResults || [];
  }, [localSearchResults, contextSearchResults]);

  // Define the internal function to clear selections
  const clearSelectedDatasetsLocally = React.useCallback(() => {
    setSelectedDatasets(new Set());
    setSelectedDatasetsInfo(new Map());
  }, []);

  // Function to perform search programmatically
  const performSearch = React.useCallback(
    (query: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not open, cannot perform search.");
        return;
      }

      setSearchInput(query); // Update the input field visually
      setIsLoading(true);
      setHasSearched(false);
      setLocalSearchResults([]);

      ws.send(
        JSON.stringify({
          action: "searchFormSubmit",
          payload: query,
        })
      );
      setIsExpanded(true); // Ensure the panel is open when search is triggered externally
    },
    [ws]
  );

  // Expose the search function using useImperativeHandle
  React.useImperativeHandle(ref, () => ({
    search: (query: string) => {
      performSearch(query);
    },
    clearSelectedDatasets: () => {
      clearSelectedDatasetsLocally(); // Call the internal function
    },
  }));

  React.useEffect(() => {
    if (ws) {
      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.action === "searchVdbResults") {
          setLocalSearchResults(data.payload || []);
          setIsLoading(false);
          setHasSearched(true);
        }
      };

      ws.addEventListener("message", handleMessage);

      return () => {
        ws.removeEventListener("message", handleMessage);
      };
    }
  }, [ws]);

  // Original submit handler for the form
  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    performSearch(searchInput); // Use the internal function now
  };

  // Add this just before the return statement in KartkatalogTab component
  React.useEffect(() => {
    console.log("Search Results Data:", searchResults);
    console.log(
      "WMS URLs available:",
      searchResults.filter((r) => r.wmsUrl && r.wmsUrl !== "None").length
    );
    console.log("Total results:", searchResults.length);
  }, [searchResults]);

  // Select/deselect dataset
  const handleSelectDataset = (dataset: SearchResult) => {
    setSelectedDatasets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataset.uuid)) {
        newSet.delete(dataset.uuid);
        setSelectedDatasetsInfo((prev) => {
          const newMap = new Map(prev);
          newMap.delete(dataset.uuid);
          return newMap;
        });
      } else {
        newSet.add(dataset.uuid);
        // Store the dataset info
        setSelectedDatasetsInfo((prev) => {
          const newMap = new Map(prev);
          newMap.set(dataset.uuid, dataset);
          return newMap;
        });
      }
      return newSet;
    });
  };

  // Bulk download selected datasets
  const handleBulkDownload = () => {
    setShowDownloadDialog(true);
  };

  const initiateDownloads = async () => {
    const downloadLinks: HTMLAnchorElement[] = [];

    selectedDatasetsInfo.forEach((dataset) => {
      console.log("Processing dataset for download:", dataset);
      if (dataset.downloadUrl) {
        const link = document.createElement("a");
        link.href = dataset.downloadUrl;
        link.setAttribute("download", "");
        link.setAttribute("target", "_blank");
        link.style.display = "none";
        document.body.appendChild(link);
        downloadLinks.push(link);
      }
    });

    for (const link of downloadLinks) {
      link.click();
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    setTimeout(() => {
      downloadLinks.forEach((link) => {
        document.body.removeChild(link);
      });
    }, 1000);

    setShowDownloadDialog(false);
    setSelectedDatasets(new Set());
    setSelectedDatasetsInfo(new Map());
  };

  const fetchDatasetDescription = async (uuid: string) => {
    if (descriptionsCache.has(uuid)) return;

    try {
      const response = await fetch(
        `https://kartkatalog.geonorge.no/api/metadata/${uuid}`
      );
      const data = await response.json();

      console.log("[DEBUG] Entire metadata response:", data);

      const extractedAbstract =
        data.Abstract ||
        data.abstract ||
        data.metadata?.abstract ||
        data.purpose ||
        "Ingen beskrivelse tilgjengelig";

      setDescriptionsCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(uuid, extractedAbstract);
        return newCache;
      });
    } catch (error) {
      console.error("Error fetching dataset description:", error);
      setDescriptionsCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(uuid, "Kunne ikke laste beskrivelse");
        return newCache;
      });
    }
  };

  const handleScroll = React.useCallback(() => {
    if (openHoverCardId) {
      setOpenHoverCardId(null);
    }
  }, [openHoverCardId]);

  const SearchSkeleton = () => (
    <div className="px-4 py-3 border-b border-gray-200">
      <Skeleton className="h-5 w-3/4 mb-2 animate-pulse" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16 animate-pulse" />
        <Skeleton className="h-7 w-16 animate-pulse" />
      </div>
    </div>
  );

  const InitialState = () => (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full mt-8">
      <div className="relative mb-6">
        <div className="p-5 bg-gray-50 rounded-full border-2 ">
          <MapIcon className="h-14 w-14 text-color-gn-primary animate-typing-dot-bounce" />
        </div>
      </div>

      <h3 className="text-xl font-medium mb-2 text-color-gn-secondarylight">
        Velkommen til Kartkatalogen
      </h3>
      <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-omar">
        <Loader2 className="h-4 w-4 text-color-gn-secondarylight animate-spin" />
        <span className="text-sm font-medium text-color-gn-secondarylight">
          Datasett lastes inn, vennligst vent...
        </span>
      </div>
    </div>
  );

  const NoResults = () => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="rounded-omar bg-gray-100 p-4 mb-4">
        <Search className="h-8 w-8 text-gray-400" />
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
      <div className="fixed right-[18px] top-1/4 flex items-start">
        {/* Main Panel */}
        <div
          ref={panelRef}
          className={cn(
            "bg-white shadow-lg transition-all duration-300 transform",
            isExpanded
              ? "w-[360px] translate-x-0 rounded-tl-sm rounded-bl-sm rounded-br-sm"
              : "w-0 translate-x-full rounded-omar",
            className
          )}
          style={{ overflow: "hidden" }}
        >
          <div id={TOUR_STEP_IDS.KARTKATALOG_PANEL} className="min-w-[350px]">
            {/* Header and search form */}
            <div className="border-b bg-white">
              <div className="px-4 py-3">
                <div className="flex items-center">
                  <h2 className="text-xl text-[#262626] mb-3 flex items-center gap-2">
                    <Library className="h-5 w-5 text-color-gn-primary" />
                    <span className="font-semibold">KARTKATALOG</span>
                  </h2>
                </div>
                <form onSubmit={onSearchSubmit} className="mb-1">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Søk etter datasett..."
                      className="flex-1 h-10 text-sm border-gray-300 rounded-omar"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="bg-white border border-gray-300 hover:bg-white text-color-gn-secondary h-10 rounded-omar transition-colors"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <ScrollArea
              className="h-[450px] bg-white"
              onScrollCapture={handleScroll}
            >
              {selectedDatasets.size > 0 && (
                <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={clearSelectedDatasetsLocally}
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-white text-gray-800 shadow-lg">
                        <p>Fjern alle</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium text-gray-700">
                      Datasett valgt
                    </span>
                    <div className="flex items-center justify-center font-semibold">
                      {selectedDatasets.size}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkDownload}
                      className="px-3 py-1.5 text-sm border shadow-sm bg-white hover:bg-gray-100 rounded-omar transition-all flex items-center gap-1"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Last ned
                    </button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-gray-200">
                {isLoading ? (
                  <>
                    <SearchSkeleton />
                    <SearchSkeleton />
                    <SearchSkeleton />
                    <SearchSkeleton />
                    <SearchSkeleton />
                  </>
                ) : !hasSearched ? (
                  <InitialState />
                ) : searchResults.length === 0 ? (
                  <NoResults />
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.uuid}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <HoverCard
                            openDelay={100}
                            closeDelay={0}
                            open={openHoverCardId === result.uuid}
                            onOpenChange={(open) => {
                              setOpenHoverCardId(open ? result.uuid : null);
                              if (open && !descriptionsCache.has(result.uuid)) {
                                fetchDatasetDescription(result.uuid);
                              }
                            }}
                          >
                            <HoverCardTrigger asChild>
                              <a
                                href={`https://kartkatalog.geonorge.no/metadata/${encodeURIComponent(
                                  result.title || "Dataset"
                                )}/${result.uuid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[16px] font-medium text-color-kv-secondary hover:text-color-gn-lightblue mb-2 max-w-max underline underline-offset-4 flex items-center gap-1 transition-colors"
                              >
                                {result.title || "Dataset"}
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="left"
                              className="w-80 p-4 rounded-omar border border-gray-200 shadow-lg"
                            >
                              <div className="space-y-0">
                                <h4 className="font-medium text-color-gn-lightblue">
                                  {result.title}
                                </h4>
                                {!descriptionsCache.has(result.uuid) ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-color-gn-secondary" />
                                    <span>Laster beskrivelse...</span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600 line-clamp-6">
                                    {descriptionsCache.get(result.uuid)}
                                  </p>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>

                          <div className="flex flex-wrap gap-2 mt-1">
                            {result.wmsUrl && result.wmsUrl !== "None" ? (
                              <button
                                onClick={() =>
                                  result.wmsUrl &&
                                  onReplaceIframe(result.wmsUrl)
                                }
                                className="px-3 py-1.5 text-sm bg-white border shadow-sm hover:bg-gray-100 text-color-kv-primary rounded-omar transition-all flex items-center gap-1 min-w-[140px] justify-center"
                              >
                                <Eye className="h-4 w-4" /> Vis på kart
                              </button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    disabled
                                    className="px-3 py-1.5 text-sm bg-gray-200 border shadow-sm text-gray-400 rounded-omar transition-all flex items-center gap-1 min-w-[140px] justify-center"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Utilgjengelig
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="px-3 py-1.5 text-sm bg-white border shadow-md hover:bg-white text-gray-800 rounded-omar transition-all flex items-center gap-1">
                                  <p>
                                    Dette datasettet kan ikke vises på kart.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {result.restricted && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="px-3 py-1.5 text-sm bg-red-100 shadow-sm text-[#DC2626] rounded-omar transition-all flex items-center gap-1 min-w-[140px] justify-center">
                                    <LockKeyhole className="h-4 w-4" /> Låst
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="px-3 py-1.5 text-sm bg-white border shadow-md hover:bg-white text-gray-800 rounded-omar transition-all flex items-center gap-1">
                                  <p>Datasettet er låst og krever tilgang.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {result.downloadUrl && (
                              <button
                                onClick={() => onDatasetDownload(result)}
                                className="px-3 py-1.5 text-sm bg-white hover:bg-gray-100 border shadow-sm rounded-omar transition-all flex items-center gap-1 min-w-[140px] justify-center"
                              >
                                <Download className="h-4 w-4" /> Last ned
                              </button>
                            )}
                          </div>
                        </div>
                        {result.downloadUrl && (
                          <Checkbox
                            checked={selectedDatasets.has(result.uuid)}
                            onCheckedChange={() => handleSelectDataset(result)}
                            className="mt-7 w-5 h-5 border border-color-gn-secondary data-[state=checked]:bg-color-gn-secondary"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Tab Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center bg-color-gn-primary hover:bg-color-gn-primarylight text-white px-2 py-4 text-sm 2xl:text-lg transition-colors ${
            isExpanded ? "rounded-r-omar border-l-2" : "rounded-omar"
          } -ml-px shadow-lg hover:shadow-xl`}
          id={TOUR_STEP_IDS.KARTKATALOG_TAB}
        >
          <div className="flex flex-col items-center gap-2">
            <Layers className="h-7 w-7" />
            <div className="flex flex-col">
              {[..."KARTKATALOG"].map((letter, index) => (
                <span key={index} className="font-medium">
                  {letter}
                </span>
              ))}
            </div>
            {isExpanded ? (
              <ChevronRight className="h-5 w-5 mt-2" />
            ) : (
              <ChevronLeft className="h-5 w-5 mt-2" />
            )}
          </div>
        </button>
      </div>

      {/* AlertDialog and other elements */}
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
              Nedlastingen vil starte umiddelbart for alle valgte datasett.
              Nettleseren din vil håndtere nedlastingene automatisk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-omar border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={initiateDownloads}
              className="rounded-omar  bg-color-gn-secondary hover:bg-color-gn-secondarylight transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Start nedlasting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
});

KartkatalogTab.displayName = "KartkatalogTab";
