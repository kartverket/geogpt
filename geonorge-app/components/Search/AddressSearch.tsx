import React, { useEffect, useState } from "react";
import { useSearch } from "@/hooks/useSearch";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Address } from "@/types/map";

interface AddressSearchProps {
  onSelectAddress: (address: Address) => void;
}

export function AddressSearch({ onSelectAddress }: AddressSearchProps) {
  const { searchResults, searchAddress } = useSearch();
  const [query, setQuery] = useState("");
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAddress(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, searchAddress]);

  return (
    <div className="absolute inset-x-0 top-4 z-[20] flex justify-center mx-auto max-w-min">
      <div className="w-96 flex relative">
        {/* Sidebar button */}
        <SidebarTrigger className="bg-[#FE642F] hover:bg-[#f35430] shadow-lg h-[42px] w-[42px] rounded-sm flex-shrink-0 mr-2" />
        <input
          type="text"
          placeholder="Søk etter adresse..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-2 border rounded-sm"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full border bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((addr, index) => (
              <div
                key={index}
                onClick={() => {
                  onSelectAddress(addr);
                  setQuery(addr.adressetekst);
                }}
                className="p-2 hover:bg-gray-100 cursor-pointer"
              >
                {addr.adressetekst}
                {addr.poststed && `, ${addr.poststed}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
