import * as React from "react";
import { Language } from "@/i18n/translations";

interface LanguageSelectorProps {
    language: Language;
    handleLanguageChange: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, handleLanguageChange }) => {
    return (
        <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-center gap-3 text-sm">
                <button
                    className={`px-2 py-1 rounded-md transition-colors ${
                        language === "nb" ? "bg-color-gn-primary/10 font-medium text-color-gn-primary" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => handleLanguageChange("nb")}
                >
                    Bokmål
                </button>
                <button
                    className={`px-2 py-1 rounded-md transition-colors ${
                        language === "nn" ? "bg-color-gn-primary/10 font-medium text-color-gn-primary" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => handleLanguageChange("nn")}
                >
                    Nynorsk
                </button>
                <button
                    className={`px-2 py-1 rounded-md transition-colors ${
                        language === "en" ? "bg-color-gn-primary/10 font-medium text-color-gn-primary" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => handleLanguageChange("en")}
                >
                    English
                </button>
            </div>
        </div>
    );
};