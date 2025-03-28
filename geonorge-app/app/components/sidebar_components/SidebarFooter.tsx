import { HelpCircle, Mail, Shield } from "lucide-react";
import { LanguageSelector } from "@/app/components/sidebar_components/LanguageSelector";
import { Language, TranslationKey } from "@/i18n/translations";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

interface SidebarFooterProps {
  language: Language;
  handleLanguageChange: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  onShowResetTour: () => void;
  onShowPrivacy: () => void;
  onShowContactUs: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  language,
  handleLanguageChange,
  t,
  onShowResetTour,
  onShowPrivacy,
  onShowContactUs,
}) => {
  type FooterItem = {
    title: string;
    icon: React.ElementType;
    onClick?: () => void;
    id?: string;
  };

  const footerLinks: FooterItem[] = [
    {
      title: t("tips_and_tricks"),
      icon: HelpCircle,
      onClick: onShowResetTour,
    },
    {
      title: t("contact_us"),
      icon: Mail,
      onClick: onShowContactUs,
      id: TOUR_STEP_IDS.FEEDBACK_BUTTON,
    },
    {
      title: t("privacy"),
      icon: Shield,
      onClick: onShowPrivacy,
    },
  ];

  return (
    <div className="border-t bg-white flex-shrink-0 shadow-sm">
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {footerLinks.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="flex flex-col items-center p-2 rounded-omar hover:bg-gray-100 transition-colors gap-1 text-left"
              title={item.title}
              id={item.id}
            >
              <div className="bg-color-gn-primary/10 rounded-full p-1.5">
                <item.icon className="h-4 w-4 text-color-gn-primary" />
              </div>
              <span className="text-xs text-gray-600 text-center truncate w-full">
                {item.title}
              </span>
            </button>
          ))}
        </div>

        <LanguageSelector
          t={t}
          language={language}
          handleLanguageChange={handleLanguageChange}
        />
      </div>
    </div>
  );
};
