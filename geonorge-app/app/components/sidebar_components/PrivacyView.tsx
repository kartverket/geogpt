import * as React from "react";
import { Shield } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { TranslationKey } from "@/i18n/translations";

interface PrivacyViewProps {
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ t, onBack }) => {
  return (
    <Section title={t("privacy_and_cookies")} icon={Shield} collapsible={false}>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-gray-600">
          <div className="py-2 space-y-4">
            {t("privacy_description")}{" "}
            <a
              href="https://www.kartverket.no/om-kartverket/personvern"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-gn-primary hover:underline font-medium"
            >
              {t("privacy_link_text")}
            </a>
          </div>
        </div>

        <button
          onClick={onBack}
          className="mt-4 bg-gray-100 hover:bg-gray-200 text-color-gn-secondary font-semibold py-2 px-4 rounded transition-colors duration-200 w-full"
        >
          {t("back_button")}
        </button>
      </div>
    </Section>
  );
};
