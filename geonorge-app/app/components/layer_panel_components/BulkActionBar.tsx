import React from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onInitiateDownload: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  onInitiateDownload,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 left-0 right-0 z-20 bg-white shadow-md border-b px-4 py-2 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm text-gray-700">
          <span className="font-medium">{selectedCount}</span> datasett valgt
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 bg-color-gn-primary hover:bg-color-gn-primarylight hover:text-white text-white"
        onClick={onInitiateDownload}
      >
        <Download className="h-4 w-4 mr-1" />
        Last ned
      </Button>
    </div>
  );
};

export default BulkActionBar;
