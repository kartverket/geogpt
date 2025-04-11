import React from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { Download, Edit, ArrowLeft, ArrowRight } from "lucide-react";

// Icons

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
          <Button variant="standard" onClick={handleClose}>
            Avbryt
          </Button>
          <div className="flex gap-2">
            <Button variant="continue" onClick={nextStep}>
              <Edit />
              Endre
            </Button>
            <Button
              variant="download"
              onClick={handleConfirmSelectionWithLoading}
            >
              <Download />
              Last ned datasett
            </Button>
          </div>
        </div>
      ) : step === 1 ? (
        <div className="flex justify-between w-full">
          <Button variant="standard" onClick={prevStep}>
            <ArrowLeft />
            Tilbake
          </Button>
          <Button variant="continue" onClick={nextStep}>
            Neste
            <ArrowRight />
          </Button>
        </div>
      ) : (
        <div className="flex justify-between w-full">
          <Button variant="standard" onClick={prevStep}>
            <ArrowLeft />
            Tilbake
          </Button>
          <Button variant="continue" onClick={nextStep}>
            Oversikt
            <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepNavigationButtons;