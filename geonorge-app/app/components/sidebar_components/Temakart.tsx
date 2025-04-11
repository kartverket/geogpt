import * as React from "react";
import { Map, Wrench, Search } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { BaseMapSelector } from "@/app/components/sidebar_components/BaseMapSelector";
import { AddressSearch } from "@/app/components/sidebar_components/AddressSearch";

import { ActionItem } from "@/app/components/sidebar_components/ActionItem";
import { TranslationKey } from "@/i18n/translations";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
interface Props {
  t: (key: TranslationKey) => string;
  layerSearch: string;
  setLayerSearch: (val: string) => void;
  filteredLayers: any[];
  filteredDatasets: any[];
  trackedDatasets: any[];
  expandedDatasets: Record<string, boolean>;
  setExpandedDatasets: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  datasetScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  datasetScrollPositionRef: React.MutableRefObject<Record<string, number>>;
  mainScrollPositionRef: React.MutableRefObject<number>;
  hasSelectedLayers: boolean;
  handleDeselectAllLayers: () => void;
  onLayerChangeWithDataset?: (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => void;
  onRemoveDataset?: (datasetId: string) => void;
  onChangeBaseLayer?: {
    revertToBaseMap: () => void;
    changeToGraattKart: () => void;
    changeToRasterKart: () => void;
    changeToSjoKart: () => void;
  };
  selectedBaseMap: string;
  setSelectedBaseMap: (val: string) => void;
  isBaseMapSectionVisible: boolean;
  isLayerSectionVisible: boolean;
  isActionSectionVisible: boolean;
  isAddressSectionVisible: boolean;
  setIsBaseMapSectionVisible: (val: boolean) => void;
  setIsLayerSectionVisible: (val: boolean) => void;
  setIsActionSectionVisible: (val: boolean) => void;
  setIsAddressSectionVisible: (val: boolean) => void;
  data: {
    actions: {
      title: string;
      url: string;
      icon: React.ElementType;
      disabled?: boolean;
      disabledMessage?: string;
    }[];
  };
  setSearchMarker: (marker: { lat: number; lng: number } | null) => void;
}

export const Temakart: React.FC<Props> = ({
  t,
  layerSearch,

  onChangeBaseLayer,
  selectedBaseMap,
  setSelectedBaseMap,
  isBaseMapSectionVisible,

  isActionSectionVisible,
  isAddressSectionVisible,
  setIsBaseMapSectionVisible,

  setIsActionSectionVisible,
  setIsAddressSectionVisible,
  data,
  setSearchMarker,
}) => {
  // State to track if we're displaying search results
  const [isSearching, setIsSearching] = React.useState(false);

  // Update the searching state whenever the search term changes
  React.useEffect(() => {
    setIsSearching(layerSearch.trim() !== "");
  }, [layerSearch]);

  return (
    <div className="space-y-4">
      <Section
        id="address"
        collapsible
        title={t("search_address")}
        icon={Search}
        isOpen={!isAddressSectionVisible}
        onToggle={() => setIsAddressSectionVisible(!isAddressSectionVisible)}
      >
        <AddressSearch setSearchMarker={setSearchMarker} t={t} />
      </Section>
      <Section
        id="basemap"
        collapsible
        title={t("background_map")}
        icon={Map}
        isOpen={!isBaseMapSectionVisible}
        onToggle={() => setIsBaseMapSectionVisible(!isBaseMapSectionVisible)}
      >
        {onChangeBaseLayer && (
          <BaseMapSelector
            selectedBaseMap={selectedBaseMap}
            onChangeBaseLayer={onChangeBaseLayer}
            t={t}
            setSelectedBaseMap={setSelectedBaseMap}
          />
        )}
      </Section>
      <div id={TOUR_STEP_IDS.APP_SIDEBAR}></div>

      <Section
        id="actions"
        title={t("tool")}
        icon={Wrench}
        collapsible
        isOpen={!isActionSectionVisible}
        onToggle={() => setIsActionSectionVisible(!isActionSectionVisible)}
      >
        <div className="space-y-1">
          {data.actions.map((action, index) => (
            <ActionItem
              key={index}
              icon={action.icon}
              title={action.title}
              url={action.url}
              disabled={action.disabled}
              disabledMessage={action.disabledMessage}
            />
          ))}
        </div>
      </Section>
    </div>
  );
};