import * as React from "react";
import { Map, Layers2, Wrench } from "lucide-react";
import { Section } from "@/app/components/sidebar_components/Section";
import { BaseMapSelector } from "@/app/components/sidebar_components/BaseMapSelector";
import { SearchInput } from "@/app/components/sidebar_components/SearchInput";
import { DeselectAllButton } from "@/app/components/sidebar_components/DeselectAllButton";
import { DatasetList } from "@/app/components/sidebar_components/DatasetList";
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
  setIsBaseMapSectionVisible: (val: boolean) => void;
  setIsLayerSectionVisible: (val: boolean) => void;
  setIsActionSectionVisible: (val: boolean) => void;
  data: {
    actions: {
      title: string;
      url: string;
      icon: React.ElementType;
    }[];
  };
}

export const Temakart: React.FC<Props> = ({
                                            t,
                                            layerSearch,
                                            setLayerSearch,
                                            filteredDatasets,
                                            trackedDatasets,
                                            expandedDatasets,
                                            setExpandedDatasets,
                                            datasetScrollContainerRef,
                                            datasetScrollPositionRef,
                                            mainScrollPositionRef,
                                            hasSelectedLayers,
                                            handleDeselectAllLayers,
                                            onLayerChangeWithDataset,
                                            onRemoveDataset,
                                            onChangeBaseLayer,
                                            selectedBaseMap,
                                            setSelectedBaseMap,
                                            isBaseMapSectionVisible,
                                            isLayerSectionVisible,
                                            isActionSectionVisible,
                                            setIsBaseMapSectionVisible,
                                            setIsLayerSectionVisible,
                                            setIsActionSectionVisible,
                                            data,
                                          }) => {
  const [isSearching, setIsSearching] = React.useState(false);

  React.useEffect(() => {
    setIsSearching(layerSearch.trim() !== "");
  }, [layerSearch]);

  return (
      <div className="space-y-4">
        <Section
            id="basemap"
            collapsible
            title={t("background_map")}
            icon={Map}
            isOpen={isBaseMapSectionVisible}
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
        <div id={TOUR_STEP_IDS.APP_SIDEBAR}>
          <Section
              id="layers"
              title={t("theme_maps")}
              icon={Layers2}
              collapsible
              isOpen={isLayerSectionVisible}
              onToggle={() => setIsLayerSectionVisible(!isLayerSectionVisible)}
          >
            <div className="space-y-3">
              <SearchInput
                  layerSearch={layerSearch}
                  setLayerSearch={setLayerSearch}
                  t={t}
              />

              {isSearching ? (
                  <div className="space-y-4">
                    {filteredDatasets.length > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm text-gray-700 ml-1">
                        {t("active_datasets")}
                      </span>
                          </div>
                          <DatasetList
                              trackedDatasets={filteredDatasets}
                              expandedDatasets={{
                                ...expandedDatasets,
                                ...filteredDatasets.reduce(
                                    (acc, dataset) => ({
                                      ...acc,
                                      [dataset.id]: true,
                                    }),
                                    {}
                                ),
                              }}
                              datasetScrollContainerRef={datasetScrollContainerRef}
                              datasetScrollPositionRef={datasetScrollPositionRef}
                              mainScrollPositionRef={mainScrollPositionRef}
                              onLayerChangeWithDataset={onLayerChangeWithDataset}
                              onRemoveDataset={onRemoveDataset}
                              setExpandedDatasets={setExpandedDatasets}
                              t={t}
                              highlightSearchTerm={layerSearch}
                          />
                        </div>
                    )}
                    {filteredDatasets.length === 0 && (
                        <div className="p-4 text-center border border-gray-200 bg-white rounded-omar">
                          <p className="text-sm text-gray-500">
                            {t("no_layers_found")}
                          </p>
                        </div>
                    )}
                  </div>
              ) : (
                  trackedDatasets.length > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm text-gray-700 ml-1">
                      {t("active_datasets")}
                    </span>
                          <DeselectAllButton
                              hasSelectedLayers={hasSelectedLayers}
                              handleDeselectAllLayers={handleDeselectAllLayers}
                              t={t}
                          />
                        </div>
                        <DatasetList
                            trackedDatasets={trackedDatasets}
                            expandedDatasets={expandedDatasets}
                            datasetScrollContainerRef={datasetScrollContainerRef}
                            datasetScrollPositionRef={datasetScrollPositionRef}
                            mainScrollPositionRef={mainScrollPositionRef}
                            onLayerChangeWithDataset={onLayerChangeWithDataset}
                            onRemoveDataset={onRemoveDataset}
                            setExpandedDatasets={setExpandedDatasets}
                            t={t}
                        />
                      </div>
                  )
              )}
            </div>
          </Section>
        </div>
        <Section
            id="actions"
            title={t("tool")}
            icon={Wrench}
            collapsible
            isOpen={isActionSectionVisible}
            onToggle={() => setIsActionSectionVisible(!isActionSectionVisible)}
        >
          <div className="space-y-1">
            {data.actions.map((action, index) => (
                <ActionItem
                    key={index}
                    icon={action.icon}
                    title={action.title}
                    url={action.url}
                />
            ))}
          </div>
        </Section>
      </div>
  );
};
