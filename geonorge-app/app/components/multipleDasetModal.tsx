import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface DuplicateDatasetAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetTitle: string;
}

const DuplicateDatasetAlertModal: React.FC<DuplicateDatasetAlertModalProps> = ({
  isOpen,
  onClose,
  datasetTitle,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Datasett finnes allerede</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-bold">{datasetTitle}</span> er allerede lagt
            til i kartet. Det er ikke mulig å legge til samme datasett flere
            ganger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onClose}
            className="text-white rounded-omar"
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DuplicateDatasetAlertModal;
