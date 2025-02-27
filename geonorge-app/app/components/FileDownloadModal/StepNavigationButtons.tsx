import React from "react";

// UI Components
import { Button } from "@/components/ui/button";

// Icons
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";

interface StepNavigationButtonsProps {
  step: number;
  nextStep: () => void;
  prevStep: () => void;
  handleClose: () => void;
  handleConfirmSelectionWithLoading: () => void;
}

const StepNavigationButtons: React.FC<StepNavigationButtonsProps> = ({
  step,
  nextStep,
  prevStep,
  handleClose,
  handleConfirmSelectionWithLoading,
}) => {
  return (
    <div className="flex justify-between mt-6">
      {step === 0 ? (
        <div className="flex justify-between w-full">
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <div className="flex gap-2">
            <Button variant="next" onClick={nextStep}>
              <EditIcon />
              Tilpass
            </Button>
            <Button
              variant="download"
              onClick={handleConfirmSelectionWithLoading}
            >
              <DownloadIcon />
              Last ned datasett
            </Button>
          </div>
        </div>
      ) : step === 1 ? (
        <div className="flex justify-between w-full">
          <Button variant="outline" onClick={prevStep}>
            Tilbake
          </Button>
          <Button variant="next" onClick={nextStep}>
            Neste
          </Button>
        </div>
      ) : (
        <div className="flex justify-between w-full">
          <Button variant="outline" onClick={prevStep}>
            Tilbake
          </Button>
          <Button
            variant="download"
            onClick={handleConfirmSelectionWithLoading}
          >
            <DownloadIcon />
            Last ned datasett
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepNavigationButtons;
