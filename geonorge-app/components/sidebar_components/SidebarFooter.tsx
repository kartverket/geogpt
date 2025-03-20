import * as React from "react";
import { HelpCircle, Mail, Shield } from "lucide-react";
import { LanguageSelector } from "@/components/sidebar_components/LanguageSelector";

interface SidebarFooterProps {
    language: String;
    handleLanguageChange: (lang: string) => void;
    t: (key: string) => string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ language, handleLanguageChange, t }) => {
    const footerLinks = [
        { title: t("tips_and_tricks"), url: "#", icon: HelpCircle },
        { title: t("contact_us"), url: "#", icon: Mail },
        { title: t("privacy"), url: "#", icon: Shield },
    ];

    return (
        <div className="border-t bg-white flex-shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            <div className="p-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {footerLinks.map((item, index) => (
                        <a
                            key={index}
                            href={item.url}
                            className="flex flex-col items-center p-2 rounded-md hover:bg-gray-50 transition-colors gap-1"
                            title={item.title}
                        >
                            <div className="bg-color-gn-primary/10 rounded-full p-1.5">
                                <item.icon className="h-4 w-4 text-color-gn-primary" />
                            </div>
                            <span className="text-xs text-gray-600 text-center truncate w-full">{item.title}</span>
                        </a>
                    ))}
                </div>
                <LanguageSelector language={language} handleLanguageChange={handleLanguageChange} />
            </div>
        </div>
    );
};