import * as React from "react";
import { ChevronDown } from "lucide-react";

interface SectionProps {
    id?: string;
    title: string;
    icon?: React.ElementType;
    children: React.ReactNode;
    collapsible?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    activeSection?: string | null;
    setActiveSection?: (id: string | null) => void;
}

export const Section: React.FC<SectionProps> = ({
                                                    id,
                                                    title,
                                                    icon: Icon,
                                                    children,
                                                    collapsible = false,
                                                    isOpen = true,
                                                    onToggle = () => {},
                                                    activeSection,
                                                    setActiveSection,
                                                }) => {
    const isActive = id === activeSection;

    return (
        <div
            className={`mb-4 bg-white rounded-lg border transition-all duration-200 overflow-hidden ${
                isActive ? "" : "border-gray-100 shadow-sm hover:border-gray-200"
            }`}
            onClick={id ? () => setActiveSection?.(id) : undefined}
        >
            <div
                className={`flex items-center gap-3 p-3 transition-colors ${
                    collapsible ? "cursor-pointer hover:bg-gray-50" : ""
                }`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (collapsible) onToggle();
                }}
            >
                {Icon && (
                    <div className="rounded-md p-1.5 flex items-center justify-center transition-colors bg-color-gn-primary/5">
                        <Icon className="h-5 w-5 text-color-gn-primary" />
                    </div>
                )}
                <h3 className={`font-medium flex-1 ${collapsible && isOpen ? "text-color-gn-primary" : "text-gray-800"}`}>
                    {title}
                </h3>
                {collapsible && (
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                            isOpen ? "text-color-gn-primary" : "text-gray-500"
                        } ${!isOpen ? "-rotate-90" : ""}`}
                    />
                )}
            </div>
            {(!collapsible || isOpen) && <div className="p-3">{children}</div>}
        </div>
    );
};