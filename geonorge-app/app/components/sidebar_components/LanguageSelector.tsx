import * as React from "react";
import { Language, TranslationKey } from "@/i18n/translations";
interface LanguageSelectorProps {
  t: (key: TranslationKey) => string;
  language: Language;
  handleLanguageChange: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  t,
  language,
  handleLanguageChange,
}) => {
  return (
    <div className="pt-2 border-t border-gray-200">
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className="text-gray-700 font-medium">{t("languages")}:</span>
        <button
          className={`px-2 py-1 rounded-omar transition-colors ${
            language === "nb"
              ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          onClick={() => handleLanguageChange("nb")}
        >
          Bokmål
        </button>
        <button
          className={`px-2 py-1 rounded-omar transition-colors ${
            language === "nn"
              ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          onClick={() => handleLanguageChange("nn")}
        >
          Nynorsk
        </button>
        <button
          className={`px-2 py-1 rounded-omar transition-colors ${
            language === "en"
              ? "bg-color-gn-primary/10 font-medium text-color-gn-primary"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          onClick={() => handleLanguageChange("en")}
        >
          English
        </button>
      </div>
    </div>
  );
};