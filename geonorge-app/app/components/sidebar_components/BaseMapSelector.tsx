import * as React from "react";
import { TranslationKey } from "@/i18n/translations";
import { Check } from "lucide-react";

interface BaseMapSelectorProps {
  selectedBaseMap: string;
  onChangeBaseLayer: {
    revertToBaseMap: () => void;
    changeToGraattKart: () => void;
    changeToRasterKart: () => void;
    changeToSjoKart: () => void;
  };
  t: (key: TranslationKey) => string;
  setSelectedBaseMap: (map: string) => void;
}

export const BaseMapSelector: React.FC<BaseMapSelectorProps> = ({
  selectedBaseMap,
  onChangeBaseLayer,
  t,
  setSelectedBaseMap,
}) => {
  const mapOptions = [
    {
      id: "landskart",
      label: t("landscape_map"),
      action: onChangeBaseLayer.revertToBaseMap,
    },
    {
      id: "graatone",
      label: t("grayscale_map"),
      action: onChangeBaseLayer.changeToGraattKart,
    },
    {
      id: "rasterkart",
      label: t("raster_map"),
      action: onChangeBaseLayer.changeToRasterKart,
    },
    {
      id: "sjokart",
      label: t("sea_map"),
      action: onChangeBaseLayer.changeToSjoKart,
    },
  ];

  return (
    <ul className="space-y-1 w-full">
      {mapOptions.map((option) => (
        <li key={option.id}>
          <button
            className={`w-full flex items-center justify-between px-3 py-2 rounded-omar text-sm ${
              selectedBaseMap === option.id
                ? "bg-color-gn-primary/10 text-color-gn-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => {
              setSelectedBaseMap(option.id);
              option.action?.();
            }}
          >
            <span>{option.label}</span>
            {selectedBaseMap === option.id && <Check className="h-4 w-4" />}
          </button>
        </li>
      ))}
    </ul>
  );
};
