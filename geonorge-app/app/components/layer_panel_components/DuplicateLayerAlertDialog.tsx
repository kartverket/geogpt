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
// Consider adding AlertTriangle icon if desired
// import { AlertTriangle } from "lucide-react";

interface DuplicateLayerAlertDialogProps {
  open: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
}

const DuplicateLayerAlertDialog: React.FC<DuplicateLayerAlertDialogProps> = ({
  open,
  message,
  onOpenChange,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl flex items-center text-yellow-700">
            {/* <AlertTriangle className="h-5 w-5 mr-2" /> Optional Icon */}
            Duplisert Kartlag Funnet
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Only one action needed: OK */}
          <AlertDialogAction
            onClick={() => onOpenChange(false)} // Simple close action
            className="rounded-lg bg-color-gn-primary hover:bg-color-gn-primary/90 text-white transition-colors"
          >
            Ok, forstått
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DuplicateLayerAlertDialog;
