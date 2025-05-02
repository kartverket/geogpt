import React, { ChangeEvent, FormEvent, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2, Sparkles, Lightbulb } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// Sample prompts for kartkatalog
const samplePrompts = [
  {
    id: "1",
    shortDesc: "Finn høydekoter",
    fullPrompt: "Finn høydekoter for hele Norge med 10 meters ekvidistanse",
  },
  {
    id: "2",
    shortDesc: "Vis bygninger i Oslo",
    fullPrompt: "Vis alle bygninger registrert i FKB i Oslo kommune",
  },
  {
    id: "3",
    shortDesc: "Finn verneområder",
    fullPrompt: "Vis alle verneområder i Norge fra Miljødirektoratet",
  },
  {
    id: "4",
    shortDesc: " Administrative grenser",
    fullPrompt: "Hent administrative grenser for fylker og kommuner",
  },
];

interface SearchFormProps {
  searchTerm: string;
  isSearching: boolean;
  filterActive: boolean; // To help decide when to show clear button
  searchMethod: "websocket" | "http";
  onSearchTermChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClearSearch: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({
  searchTerm,
  isSearching,
  filterActive,
  searchMethod,
  onSearchTermChange,
  onSubmitSearch,
  onClearSearch,
}) => {
  const isWebsocketSearch = searchMethod === "websocket";
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSampleClick = (prompt: string) => {
    onSearchTermChange(prompt);
    setPopoverOpen(false);
    inputRef.current?.focus();
  };

  // Determine if the X/Loader container area should be active
  const showClearOrLoadingArea = searchTerm || filterActive || isSearching;

  const rightPadding = isWebsocketSearch
    ? "pr-16"
    : showClearOrLoadingArea
    ? "pr-9"
    : "pr-3";

  const inputElement = (
    <Input
      ref={inputRef}
      value={searchTerm}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onSearchTermChange(e.target.value)
      }
      placeholder={
        isWebsocketSearch ? "Spør GeoGPT..." : "Søk etter datasett..."
      }
      className={`pl-9 ${rightPadding} relative rounded-lg focus:ring-0 focus:outline-none focus:border-0 border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
        isWebsocketSearch ? "bg-transparent" : "bg-white border border-gray-300"
      }`}
      disabled={isSearching}
    />
  );

  return (
    <form onSubmit={onSubmitSearch} className="relative mb-3">
      {isWebsocketSearch ? (
        <div className="relative group">
          <div
            className="absolute -inset-[1px] rounded-lg blur-[1px] opacity-75 group-hover:opacity-100 transition animate-border-rotate"
            style={{
              background:
                "linear-gradient(45deg, #3b82f6, #fe642f, #a855f7, #3b82f6)",
              backgroundSize: "200% 200%",
            }}
          ></div>
          <div className="absolute inset-0 bg-white rounded-lg"></div>
          {inputElement}
        </div>
      ) : (
        inputElement
      )}

      <button
        type="submit"
        className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-color-gn-primary disabled:opacity-50 z-10"
        aria-label="Submit search"
        disabled={isSearching || !searchTerm.trim()}
      >
        {isWebsocketSearch ? <Sparkles size={16} /> : <Search size={16} />}
      </button>

      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 z-10">
        {isWebsocketSearch && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-gray-500 hover:text-color-gn-primary"
                aria-label="Show sample prompts"
              >
                <Lightbulb size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="center">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 px-2 pb-1">
                  Eksempel-prompts:
                </p>
                {samplePrompts.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSampleClick(sample.fullPrompt)}
                    className="block w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors duration-150"
                  >
                    {sample.shortDesc}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {(searchTerm || filterActive || isSearching) && (
          <div className="h-6 w-6 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onSearchTermChange("")}
              aria-label="Clear search term"
              className={`p-0 h-full w-full items-center justify-center text-gray-500 hover:text-color-gn-primary m-0 ${
                !isSearching && (searchTerm || filterActive) ? "flex" : "hidden"
              }`}
            >
              <X size={16} />
            </button>

            <div
              className={`h-full w-full flex items-center justify-center ${
                isSearching ? "flex" : "hidden"
              }`}
            >
              <Loader2
                size={16}
                className="text-color-gn-primary animate-spin"
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default SearchForm;
