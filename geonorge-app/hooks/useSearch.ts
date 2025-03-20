import { useState } from "react";
import { Address } from "@/types/map";

export function useSearch() {
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  
  const searchAddress = async (query: string) => {
    // Clear results if query is empty or too short
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://ws.geonorge.no/adresser/v1/sok?sok=${query}&treffPerSide=5`
      );
      const data = await response.json();
      setSearchResults(data.adresser);
    } catch (error) {
      console.error("Error searching address:", error);
    }
  };

  return {
    searchResults,
    setSearchResults,
    searchAddress
  };
}
