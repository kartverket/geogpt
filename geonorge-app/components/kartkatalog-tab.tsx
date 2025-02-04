"use client";

import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SearchResult {
  uuid: string;
  title?: string;
  wmsUrl?: string;
  downloadUrl?: string | null;
  restricted?: boolean;
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
    <div className="fixed right-[18px] top-1/4 flex items-start ">
      {/* Main Panel */}
      <div
        className={cn(
          "bg-white shadow-[-1px_1px_3px_0_rgba(0,0,0,0.24)] transition-all duration-300 transform rounded-l rounded-br ",
          isExpanded ? "w-[300px] translate-x-0" : "w-0 translate-x-full",
          className
        )}
        style={{ overflow: "hidden" }}
      >
        <div className="min-w-[300px] bg-white font-['Helvetica_Neue',_Arial,_sans-serif]">
          <div className="border-b">
            <div className="px-4 py-3 bg-white">
              <div className="flex items-center">
                <h2 className="text-xl  text-[#262626] mb-3 flex items-center gap-1">
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

          <ScrollArea className="h-[400px] ">
            <div className="divide-y divide-gray-200 ">
              {isLoading ? (
                // Show 3 loading skeletons while searching
                <>
                  <SearchSkeleton />
                  <SearchSkeleton />
                  <SearchSkeleton />
                  <SearchSkeleton />
                  <SearchSkeleton />
                </>
              ) : hasSearched && searchResults.length === 0 ? (
                // Show message when no results found
                <div className="px-4 py-6 text-center text-gray-500">
                  Ingen resultater funnet
                </div>
              ) : (
                // Show actual results
                searchResults.map((result) => (
                  <div
                    key={result.uuid}
                    className="px-4 py-3 hover:bg-[#F5F5F5] transition-colors"
                  >
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
                    <div className="flex gap-2">
                      {result.wmsUrl && result.wmsUrl !== "None" ? (
                        <button
                          onClick={() =>
                            result.wmsUrl && onReplaceIframe(result.wmsUrl)
                          }
                          className="px-3 py-1.5 text-sm bg-[#FF8B65] hover:bg-[#FE642F] text-white rounded-[2px] transition-colors flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" /> Vis
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-400 rounded-[2px] cursor-not-allowed flex items-center gap-1"
                        >
                          <XCircle className="h-4 w-4" /> Utilgjengelig
                        </button>
                      )}
                      {result.restricted && (
                        <button className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-[2px] flex items-center gap-1">
                          <LockKeyhole className="h-4 w-4" /> Låst
                        </button>
                      )}
                      {result.downloadUrl && (
                        <button
                          onClick={() => onDatasetDownload(result.downloadUrl!)}
                          className="px-3 py-1.5 text-sm bg-[#404041] hover:bg-[#5c5c5d] text-white rounded-[2px] transition-colors flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" /> Last ned
                        </button>
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
        className={`flex items-center bg-[#FF8B65] hover:bg-[#FE642F] text-white px-2 py-6 ${
          isExpanded ? "rounded-r-[2px] border-l-2" : "rounded-[2px]"
        } -ml-px`}
      >
        <div className="flex flex-col items-center gap-3">
          <Layers className="h-5 w-5" />
          <div className="writing-mode-vertical-lr transform rotate-180 text-sm font-medium whitespace-nowrap">
            KARTKATALOGEN
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
  );
}
