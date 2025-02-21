import React from "react";

// UI Components
import { Button } from "@/components/ui/button";

// Icons
import DownloadIcon from "@mui/icons-material/Download";

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
              Tilpass
            </Button>
            <Button
              variant="download"
              onClick={handleConfirmSelectionWithLoading}
            >
              <DownloadIcon className="mr-2" />
              Last ned datasett
            </Button>
          </div>
        </div>
      ) : step > 0 && step < 3 ? (
        <div className="flex justify-between w-full">
          {step > 1 && (
            <Button variant="outline" onClick={prevStep}>
              Tilbake
            </Button>
          )}
          {step === 1 && (
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Avbryt
                </Button>
              </div>
              <Button variant="next" onClick={nextStep}>
                Neste
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="flex justify-end w-full">
              <Button variant="next" onClick={nextStep}>
                Neste
              </Button>
            </div>
          )}
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
            <DownloadIcon className="mr-2" />
            Last ned datasett
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepNavigationButtons;
