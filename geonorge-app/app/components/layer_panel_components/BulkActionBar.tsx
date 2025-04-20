import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    return null; // Don't render if nothing is selected
  }

  return (
    // Wrap TooltipProvider here if not already provided by parent
    <TooltipProvider delayDuration={100}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center shadow-sm mb-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onClearSelection}
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 border-gray-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-white text-gray-800 shadow-lg rounded-md">
              <p>Fjern valg</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} valgt
          </span>
        </div>
        <Button
          onClick={onInitiateDownload}
          size="sm"
          className="px-3 py-1.5 text-sm border shadow-sm bg-color-gn-primary hover:bg-color-gn-primary/90 text-white rounded-md transition-all"
        >
          <Download className="h-4 w-4 mr-1" />
          Last ned valgte
        </Button>
      </div>
    </TooltipProvider>
  );
};

export default BulkActionBar;
