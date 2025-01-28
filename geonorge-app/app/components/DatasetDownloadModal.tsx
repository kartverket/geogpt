import React from "react";

// UI Components
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

// Icons
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import GeoNorgeLogo from "./GeoNorgeLogo";

interface DatasetDownloadModalProps {
  isOpen: boolean;
  handleClose: () => void;
  handleDownload: () => void;
  datasetName: string;
  datasetDownloadLink: string;
  datasetLink: string;
  fileSize: string;
  title: string;
}

const DatasetDownloadModal: React.FC<DatasetDownloadModalProps> = ({
  isOpen,
  handleClose,
  handleDownload,
  datasetName,
  datasetDownloadLink,
  datasetLink,
  fileSize,
}) => {
  const formatInfo = "ZIP"; // Datasett are all ZIP files
  // Conditional rendering to avoid unnecessary rendering of the modal when `isOpen` is false
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="logo-container">
            <GeoNorgeLogo />
          </div>
          <AlertDialogTitle className="text-color-gn-secondary">
            Bekreft nedlasting
          </AlertDialogTitle>
          <Separator />
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 text-color-gn-secondary hover:text-gray-800"
            aria-label="Lukk"
          >
            <CloseIcon />
          </button>
        </AlertDialogHeader>

        <AlertDialogDescription className="space-y-2">
          <span className="block mt-2 text-sm text-color-gn-secondary">
            <strong>Datasettets navn:</strong> {datasetName}
          </span>
          <span className="block mt-2 text-sm text-color-gn-secondary">
            <strong>Link til datasettet:</strong>{" "}
            <a
              href={datasetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {datasetLink}
            </a>
          </span>
          {fileSize && (
            <span className="block mt-2 text-sm text-color-gn-secondary">
              <strong>Filstørrelse:</strong> {fileSize}
            </span>
          )}
          <span className="block mt-2 text-sm text-color-gn-secondary">
            <strong>Formatinformasjon:</strong> {formatInfo}
          </span>
          <span className="block mt-2 text-sm text-color-gn-secondary">
            <strong>Link til nedlasting:</strong>{" "}
            <a
              href={datasetDownloadLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {datasetDownloadLink}
            </a>
          </span>
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            className="bg-color-gn-primarylight hover:bg-orange-500"
            onClick={handleDownload}
          >
            <DownloadIcon />
            Last ned
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DatasetDownloadModal;
