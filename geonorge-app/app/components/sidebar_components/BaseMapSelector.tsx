import * as React from "react";
import { BaseMapButton } from "@/app/components/sidebar_components/BaseMapButton";
import { TranslationKey } from "@/i18n/translations";

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
  return (
    <div className="grid grid-cols-2 gap-2">
      <BaseMapButton
        selected={selectedBaseMap === "landskart"}
        onClick={() => {
          setSelectedBaseMap("landskart");
          onChangeBaseLayer.revertToBaseMap();
        }}
        imageSrc="https://norgeskart.no/assets/img/land.png"
        altText="Landskap kart"
        label={t("landscape_map")}
      />

      <BaseMapButton
        selected={selectedBaseMap === "graatone"}
        onClick={() => {
          setSelectedBaseMap("graatone");
          onChangeBaseLayer.changeToGraattKart();
        }}
        imageSrc="https://norgeskart.no/assets/img/grey.png"
        altText="Gråtone kart"
        label={t("grayscale_map")}
      />

      <BaseMapButton
        selected={selectedBaseMap === "rasterkart"}
        onClick={() => {
          setSelectedBaseMap("rasterkart");
          onChangeBaseLayer.changeToRasterKart();
        }}
        imageSrc="https://norgeskart.no/assets/img/raster.png"
        altText="Raster kart"
        label={t("raster_map")}
      />
      <BaseMapButton
        selected={selectedBaseMap === "sjokart"}
        onClick={() => {
          setSelectedBaseMap("sjokart");
          onChangeBaseLayer.changeToSjoKart();
        }}
        imageSrc="https://norgeskart.no/assets/img/dummy.png"
        altText="Sjø kart"
        label={t("sea_map")}
      />
    </div>
  );
};
