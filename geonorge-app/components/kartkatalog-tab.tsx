"use client";

import * as React from "react";
import L from "leaflet";
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
  onDatasetDownload: (downloadUrl: string) => void;
  ws: WebSocket | null;
}

export function KartkatalogTab({
  className,
  onReplaceIframe,
  onDatasetDownload,
  ws,
}: KartkatalogTabProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [selectedDatasets, setSelectedDatasets] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedDatasetsInfo, setSelectedDatasetsInfo] = React.useState<
    Map<string, SearchResult>
  >(new Map());
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [descriptionsCache, setDescriptionsCache] = React.useState<Map<string, string>>(new Map());

  // Create a ref for the main panel container
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (panelRef.current) {
      // This will prevent the scroll (wheel) events on the panel from propagating to the map.
      L.DomEvent.disableScrollPropagation(panelRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (ws) {
      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.action === "searchVdbResults") {
          setSearchResults(data.payload);
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

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setIsLoading(true);
    setHasSearched(false);
    ws.send(
      JSON.stringify({
        action: "searchFormSubmit",
        payload: searchInput,
      })
    );
  };

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

  const initiateDownloads = () => {
    // Use the stored dataset information for downloads
    selectedDatasetsInfo.forEach((dataset) => {
      if (dataset.downloadUrl) {
        const link = document.createElement("a");
        link.href = dataset.downloadUrl;
        link.setAttribute("download", "");
        link.setAttribute("target", "_blank");
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });

    setShowDownloadDialog(false);
    setSelectedDatasets(new Set()); // Clear selection after download
    setSelectedDatasetsInfo(new Map());
  };

  const fetchDatasetDescription = async (uuid: string) => {
    if (descriptionsCache.has(uuid)) return;

    try {
      const response = await fetch(`https://kartkatalog.geonorge.no/api/metadata/${uuid}`);
      const data = await response.json();

      console.log("[DEBUG] Entire metadata response:", data);

      let extractedAbstract = data.Abstract
        || data.abstract
        || data.metadata?.abstract
        || data.purpose
        || "Ingen beskrivelse tilgjengelig";
      
      setDescriptionsCache(prev => {
        const newCache = new Map(prev);
        newCache.set(uuid, extractedAbstract);
        return newCache;
      });
    } catch (error) {
      console.error('Error fetching dataset description:', error);
      setDescriptionsCache(prev => {
        const newCache = new Map(prev);
        newCache.set(uuid, 'Kunne ikke laste beskrivelse');
        return newCache;
      });
    }
  };

  // Loading skeleton component
  const SearchSkeleton = () => (
    <div className="px-4 py-3 border-b border-gray-200">
      <Skeleton className="h-5 w-3/4 mb-2" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={100}>
      <div className="fixed right-[18px] top-1/4 flex items-start ">
        {/* Main Panel */}
        <div
          ref={panelRef}
          className={cn(
            "bg-white shadow-[-1px_1px_3px_0_rgba(0,0,0,0.24)] transition-all duration-300 transform rounded-l rounded-br",
            isExpanded ? "w-[300px] translate-x-0" : "w-0 translate-x-full",
            className
          )}
          style={{ overflow: "hidden" }}
        >
          <div className="min-w-[300px] bg-white font-['Helvetica_Neue',_Arial,_sans-serif]">
            {/* Header and search form */}
            <div className="border-b">
              <div className="px-4 py-3 bg-white">
                <div className="flex items-center">
                  <h2 className="text-xl text-[#262626] mb-3 flex items-center gap-1">
                    <Library className="h-5 w-5" />
                    <span>KARTKATALOGEN</span>
                  </h2>
                </div>
                <form onSubmit={onSearchSubmit} className="mb-1">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Søk etter datasett..."
                      className="flex-1 h-9 text-sm border-gray-300 rounded-[2px]"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="bg-[#F5F5F5] hover:bg-gray-200 text-gray-700 h-9 border rounded-[2px]"
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

            <ScrollArea className="h-[400px]">
              {selectedDatasets.size > 0 && (
                <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-2 flex justify-between items-center">
                  <span className="ml-1 text-sm text-gray-800">
                    {selectedDatasets.size} datasett valgt
                  </span>
                  <Button
                    onClick={handleBulkDownload}
                    size="sm"
                    className="bg-[#404041] hover:bg-[#5c5c5d] text-white rounded-[2px] text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Last ned valgte
                  </Button>
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
                ) : hasSearched && searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500">
                    Ingen resultater funnet
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.uuid}
                      className="px-4 py-3 hover:bg-[#F5F5F5] transition-colors"
                    >
                      {/* ...result content */}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <HoverCard openDelay={200} closeDelay={0} onOpenChange={(open) => {
                            if (open && !descriptionsCache.has(result.uuid)) {
                              fetchDatasetDescription(result.uuid);
                            }
                          }}>
                            <HoverCardTrigger asChild>
                              <a
                                href={`https://kartkatalog.geonorge.no/metadata/${encodeURIComponent(
                                  result.title || "Dataset"
                                )}/${result.uuid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[15px] text-gray-900 hover:text-gray-600 mb-2 max-w-max underline underline-offset-4 flex items-center gap-1"
                              >
                                {result.title || "Dataset"}
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </HoverCardTrigger>
                            <HoverCardContent 
                              side="left"
                              className="w-80"
                            >
                              <div className="space-y-2">
                                <h4 className="font-medium">{result.title}</h4>
                                {!descriptionsCache.has(result.uuid) ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Laster beskrivelse...
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600">
                                    {descriptionsCache.get(result.uuid)}
                                  </p>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          
                          <div className="flex gap-2">
                            {result.wmsUrl && result.wmsUrl !== "None" ? (
                              <button
                                onClick={() =>
                                  result.wmsUrl &&
                                  onReplaceIframe(result.wmsUrl)
                                }
                                className="px-3 py-1.5 text-sm bg-[#FF8B65] hover:bg-[#FE642F] text-white rounded-[2px] transition-colors flex items-center gap-1"
                              >
                                <Eye className="h-4 w-4" /> Vis
                              </button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    disabled
                                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-400 rounded-[2px] cursor-pointer flex items-center gap-1"
                                  >
                                    <XCircle className="h-4 w-4" />{" "}
                                    Utilgjengelig
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Dette datasettet kan ikke vises.
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {result.restricted && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-[2px] flex items-center gap-1">
                                    <LockKeyhole className="h-4 w-4" /> Låst
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Datasettet er låst og krever tilgang.
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {result.downloadUrl && (
                              <button
                                onClick={() =>
                                  onDatasetDownload(result.downloadUrl!)
                                }
                                className="px-3 py-1.5 text-sm bg-[#404041] hover:bg-[#5c5c5d] text-white rounded-[2px] transition-colors flex items-center gap-1"
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
                            className="mt-1 rounded-[2px]"
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
          className={`flex items-center bg-[#FE642F] hover:bg-[#f35a30] text-white px-2 py-6 ${
            isExpanded ? "rounded-r-[2px] border-l-2" : "rounded-[2px]"
          } -ml-px`}
        >
    <div className="flex flex-col items-center gap-3">
      <Layers className="h-7 w-7" />
      <div className="flex flex-col">
        {[..."KARTKATALOGEN"].map((letter, index) => (
          <span key={index} className="text-md font-medium">
            {letter}
          </span>
        ))}
      </div>
      {isExpanded ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
    </div>


        </button>

        <style jsx>{`
          .writing-mode-vertical-lr {
            writing-mode: vertical-lr;
          }
        `}</style>
      </div>

      {/* AlertDialog and other elements */}
      <AlertDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Last ned {selectedDatasets.size} datasett
            </AlertDialogTitle>
            <AlertDialogDescription>
              Nedlastingen vil starte umiddelbart for alle valgte datasett.
              Nettleseren din vil håndtere nedlastingene automatisk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[2px]">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={initiateDownloads}
              className="rounded-[2px]"
            >
              Start nedlasting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
