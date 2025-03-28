import * as React from "react";
import { Mail, Phone, ExternalLink } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { TranslationKey } from "@/i18n/translations";

interface ContactUsViewProps {
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

export const ContactUsView: React.FC<ContactUsViewProps> = ({ t, onBack }) => {
  return (
    <Section title={t("contact_us")} icon={Mail} collapsible={false}>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-gray-600">
          <div className="py-2 space-y-4">
            <p className="font-medium text-color-gn-secondary">
              {t("feedback_question")}
            </p>

            <p className="text-color-gn-secondary">
              {t("feedback_description")}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-color-gn-primary" />
                <span>
                  {t("phone_label")}{" "}
                  <a
                    href="tel:+4732118000"
                    className="text-color-gn-secondary hover:underline"
                  >
                    32 11 80 00
                  </a>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-color-gn-primary" />
                <span>
                  {t("email_label")}{" "}
                  <a
                    href="mailto:post@kartverket.no"
                    className="text-color-gn-secondary hover:underline"
                  >
                    post@kartverket.no
                  </a>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://forms.office.com/e/Zmsz9J4ELX?origin=lprLink"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-color-gn-primary hover:underline font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{t("feedback_form")}</span>
              </a>
            </div>
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
