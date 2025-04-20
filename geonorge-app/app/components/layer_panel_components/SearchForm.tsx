import React, { ChangeEvent, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";

interface SearchFormProps {
  searchTerm: string;
  isSearching: boolean;
  filterActive: boolean; // To help decide when to show clear button
  onSearchTermChange: (value: string) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClearSearch: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({
  searchTerm,
  isSearching,
  filterActive,
  onSearchTermChange,
  onSubmitSearch,
  onClearSearch,
}) => {
  return (
    <form onSubmit={onSubmitSearch} className="relative mb-3">
      <Input
        value={searchTerm}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onSearchTermChange(e.target.value)
        }
        placeholder="Søk etter datasett..."
        className="pl-9 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-color-gn-primary focus:border-color-gn-primary"
        disabled={isSearching}
      />
      <button
        type="submit"
        className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-color-gn-primary disabled:opacity-50"
        aria-label="Submit search"
        disabled={isSearching || !searchTerm.trim()}
      >
        <Search size={16} />
      </button>
      {(searchTerm || filterActive) && !isSearching && (
        <button
          type="button"
          className="absolute right-3 top-1/2 transform -translate-y-1/2"
          onClick={onClearSearch}
          aria-label="Clear search and filters"
        >
          <X size={16} className="text-gray-500 hover:text-color-gn-primary" />
        </button>
      )}
      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 size={16} className="text-color-gn-primary animate-spin" />
        </div>
      )}
    </form>
  );
};

export default SearchForm;
