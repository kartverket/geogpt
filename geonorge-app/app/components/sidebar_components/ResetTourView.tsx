import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { TranslationKey } from "@/i18n/translations";
import { toast } from "sonner";

interface ResetTourViewProps {
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

export const ResetTourView: React.FC<ResetTourViewProps> = ({ t, onBack }) => {
  // Handler to reset the tour state
  const handleResetTour = () => {
    localStorage.removeItem("geonorgeTourCompleted");
    toast.success(t("tour_reset_toast_message"), {
      classNames: {
        toast: "border-0 border-l-4 border-color-gn-primary p-6",
        title: "text-black text-md",
        icon: "text-color-gn-primary h-6 w-6",
      },
    });
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
