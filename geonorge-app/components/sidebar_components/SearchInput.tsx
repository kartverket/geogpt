import * as React from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
    layerSearch: string;
    setLayerSearch: (value: string) => void;
    t: (key: string) => string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ layerSearch, setLayerSearch, t }) => {
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setLayerSearch(e.target.value);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    return (
        <div className="relative">
            <input
                ref={searchInputRef}
                type="text"
                placeholder={t("search_layers")}
                value={layerSearch}
                onChange={handleSearchChange}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full pl-10 p-2.5 border border-gray-100 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-color-gn-secondary/10 bg-white"
                style={{ zIndex: 10 }}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
    );
};