import * as React from "react";
import { Trash2 } from "lucide-react";
import {TranslationKey} from "@/i18n/translations";

interface DeselectAllButtonProps {
    hasSelectedLayers: boolean;
    handleDeselectAllLayers: () => void;
    t: (key: TranslationKey) => string;
}

export const DeselectAllButton: React.FC<DeselectAllButtonProps> = ({ hasSelectedLayers, handleDeselectAllLayers, t }) => {
    if (!hasSelectedLayers) return null;

    return (
        <button
            onClick={handleDeselectAllLayers}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
        >
            <Trash2 className="h-3 w-3" />
            <span>{t("deselect_all")}</span>
        </button>
    );
};