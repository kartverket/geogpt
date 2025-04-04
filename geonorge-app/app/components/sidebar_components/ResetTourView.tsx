import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { TranslationKey } from "@/i18n/translations";

interface ResetTourViewProps {
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

export const ResetTourView: React.FC<ResetTourViewProps> = ({ t, onBack }) => {
  // Handler to reset the tour state
  const handleResetTour = () => {
    localStorage.removeItem("geonorgeTourCompleted");
    // Page reload, vurdere å sette toaster istedenfor?
    window.location.reload();
  };

  return (
    <Section title={t("reset_tour_title")} icon={RotateCcw} collapsible={false}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">{t("tour_reset_message")}</p>
        <button
          onClick={handleResetTour}
          className="bg-color-gn-primary hover:bg-color-gn-primary/80 text-white font-semibold py-2 px-4 rounded transition-colors duration-200 w-full"
        >
          {t("reset_tour_button")}
        </button>
        <button
          onClick={onBack}
          className="bg-gray-100 hover:bg-gray-200 text-color-gn-secondary font-semibold py-2 px-4 rounded transition-colors duration-200 w-full"
        >
          {t("back_button")}
        </button>
      </div>
    </Section>
  );
};
