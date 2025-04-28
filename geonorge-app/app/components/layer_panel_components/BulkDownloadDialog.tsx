import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"; // Although not used directly, good practice if extending
import { Download } from "lucide-react";

interface BulkDownloadDialogProps {
  open: boolean;
  selectedCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirmDownload: () => void;
}

const BulkDownloadDialog: React.FC<BulkDownloadDialogProps> = ({
  open,
  selectedCount,
  onOpenChange,
  onConfirmDownload,
}) => {
  if (selectedCount === 0) {
    // Although parent controls open state, double-check count
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl flex items-center text-gray-800">
            Last ned {selectedCount} datasett
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600">
            Nedlastingsprosessen vil starte for alle valgte datasett.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3">
          <AlertDialogCancel className="rounded-lg border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDownload}
            className="rounded-lg bg-color-gn-primary hover:bg-color-gn-primary/90 text-white transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Start nedlasting
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BulkDownloadDialog;
