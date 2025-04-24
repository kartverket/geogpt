import React, { useRef, useState, useEffect } from "react";
import { Home, X } from "lucide-react";
import { TranslationKey } from "@/i18n/translations";

interface Address {
  adressetekst: string;
  poststed?: string;
  representasjonspunkt: {
    lat: number;
    lon: number;
  };
}

interface AddressSearchProps {
  setSearchMarker: (marker: { lat: number; lng: number } | null) => void;
  t: (key: TranslationKey) => string;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({
  t,
  setSearchMarker,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Address fetching
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!searchQuery || searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await fetch(
          `https://ws.geonorge.no/adresser/v1/sok?sok=${searchQuery}&treffPerSide=8`
        );
        if (!response.ok) throw new Error("Feil ved henting av adresser");
        const data = await response.json();
        setSearchResults(data.adresser || []);
      } catch (error) {
        console.error("Feil ved søk:", error);
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(fetchAddresses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Focus search input on mount
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectAddress = (address: Address) => {
    const { lat, lon } = address.representasjonspunkt;
    const markerCoords = { lat, lng: lon };

    if (typeof setSearchMarker === "function") {
      try {
        setSearchMarker(markerCoords);
      } catch (error) {
        console.error("AddressSearch: Error calling setSearchMarker:", error);
      }
    }

    setSearchQuery(address.adressetekst);
    setSearchResults([]);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  return (
    <div className="w-full">
      {/* Search input */}
      <div className="flex items-center relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
          <Home size={18} className="text-color-gn-primary" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          placeholder={t("search_address_placeholder")}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Address search"
          className="w-full h-10 pl-10 pr-10 py-2 text-sm bg-white border border-gray-300 rounded-omar placeholder:text-gray-400 text-gray-800 focus:outline-none focus:border-color-gn-primary"
        />

        {/* Clear button */}
        {searchQuery && (
          <button
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 text-gray-500"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="mt-1 w-full border border-gray-200 bg-white rounded-omar shadow-lg max-h-60 overflow-y-auto z-50">
          {searchResults.map((addr, index) => (
            <div
              key={index}
              onClick={() => selectAddress(addr)}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              tabIndex={0}
              role="option"
              aria-selected="false"
            >
              <div className="text-sm text-gray-800 truncate">
                {addr.adressetekst}
              </div>
              {addr.poststed && (
                <div className="text-xs text-gray-500 truncate">
                  {addr.poststed}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
