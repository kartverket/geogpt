import React from "react";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

interface FilterControlsProps {
  filterType: string | null;
  activeLayerCount: number;
  onFilterTypeChange: (newFilter: string | null) => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filterType,
  activeLayerCount,
  onFilterTypeChange,
}) => {
  return (
    <div className="flex gap-2 my-2 flex-wrap">
      <Badge
        variant={filterType === "active" ? "default" : "outline"}
        className={`cursor-pointer transition-all duration-200 ${
          filterType === "active"
            ? "bg-color-gn-primary hover:bg-color-gn-primary/90 text-white"
            : "border-gray-300 text-gray-700 hover:bg-gray-100"
        }`}
        onClick={() =>
          onFilterTypeChange(filterType === "active" ? null : "active")
        }
      >
        <Eye size={14} className="mr-1" /> Aktive lag ({activeLayerCount})
      </Badge>
      {/* Add other filter badges here if needed in the future */}
    </div>
  );
};

export default FilterControls;
