"use client";
import React, { useState, useEffect, useMemo } from "react";
import { HelpCircle, Send, X, Database } from "lucide-react";
import Image from "next/image";
import "leaflet/dist/leaflet.css";
import { LayerPanel } from "@/app/components/LayerPanel";
import { AppSidebar } from "@/app/components/app-sidebar";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { useSidebar } from "@/components/ui/sidebar";
import { ChatWindow } from "@/app/components/chat_components/ChatWindow";
import { useWebSocket } from "@/app/components/chat_components/useWebSocket";
import FullScreenChatView from "@/app/components/chat_components/FullScreenChatView";
import {
  ChatMessage as WebSocketChatMessage,
  SearchResult,
  ActiveLayerInfo,
} from "@/app/components/chat_components/types";
import { useChatManagement } from "@/hooks/useChatManagement";
import { useWmsManagement } from "@/hooks/useWmsManagement";
import { useDownloadManagement } from "@/hooks/useDownloadManagement";
import { useBaseLayerManagement } from "@/hooks/useBaseLayerManagement";
import { useMapState } from "@/hooks/useMapState";
import dynamic from "next/dynamic";
import hodetTilOmar from "@/app/components/Skjermbilde 2025-04-10 kl. 14.45.23.png";
import FileDownloadModal from "@/app/components/FileDownloadModal/FileDownloadModal";

const MapWithNoSSR = dynamic(() => import("@/components/map-wrapper"), {
  ssr: false,
});

const DemoV4 = () => {
  // === MOVE HOOKS INSIDE THE COMPONENT ===
  const mapState = useMapState();
  const { state } = useSidebar();
  const {
    currentBaseLayer,
    revertToBaseMap,
    changeToGraattKart,
    changeToRasterKart,
    changeToSjoKart,
  } = useBaseLayerManagement();

  const wmsManagement = useWmsManagement();

  const {
    isFileDownloadModalOpen,
    geographicalAreas,
    projections,
    formats,
    specificObject,
    handleAreaChange,
    executeDatasetDownload,
    confirmDownload,
    handleStandardDownload,
    handleModalClose,
  } = useDownloadManagement();

  const [modalOpen, setModalOpen] = useState(false);
  const {
    messages: wsMessages,
    isStreaming,
    sendMessage,
    ws,
    mapUpdates,
    searchResults,
    clearMapUpdates,
  } = useWebSocket();

  // Pass the REAL executeDatasetDownload to useChatManagement
  const chatManagement = useChatManagement({
    messages: wsMessages,
    isStreaming,
    sendMessage,
    executeDatasetDownload: executeDatasetDownload,
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [showInitialInput, setShowInitialInput] = useState(true);
  const [activeMapLayers, setActiveMapLayers] = useState<ActiveLayerInfo[]>([]);
  // Add state for LayerPanel filter
  const [layerPanelFilter, setLayerPanelFilter] = useState<string | null>(null);
  // State to track the dataset just added via chat
  const [datasetJustAddedFromChat, setDatasetJustAddedFromChat] =
    useState<SearchResult | null>(null);

  // === MOVE EFFECTS INSIDE THE COMPONENT ===
  // Handle map updates from WebSocket
  useEffect(() => {
    // Only process if mapUpdates is not null and has actual updates
    if (mapUpdates && Object.keys(mapUpdates).length > 0) {
      console.log("Processing map updates:", mapUpdates);

      // Handle center coordinates update
      if (mapUpdates.center) {
        mapState.setMap?.((prevMap: any) => {
          if (prevMap) {
            prevMap.setView(
              mapUpdates.center as [number, number],
              mapUpdates.zoom || prevMap.getZoom()
            );
          }
          return prevMap;
        });
      }

      // Handle zoom level update (if no center was provided)
      if (mapUpdates.zoom && !mapUpdates.center) {
        mapState.setMap?.((prevMap: any) => {
          if (prevMap) {
            prevMap.setZoom(mapUpdates.zoom as number);
          }
          return prevMap;
        });
      }

      // Handle markers update
      if ("markers" in mapUpdates) {
        mapState.clearSearchMarkers();
        if (mapUpdates.markers && mapUpdates.markers.length > 0) {
          mapUpdates.markers.forEach((marker) => {
            mapState.addSearchMarker({
              lat: marker.lat,
              lng: marker.lng,
              label: marker.label,
            });
          });
          if (mapUpdates.markers.length === 1) {
            const marker = mapUpdates.markers[0];
            mapState.setSearchMarker({
              lat: marker.lat,
              lng: marker.lng,
            });
          }
        } else {
          mapState.setSearchMarker(null);
        }
      }

      // Handle find my location request
      if (mapUpdates.findMyLocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            mapState.setUserMarker({ lat: latitude, lng: longitude });
            mapState.setMap?.((prevMap: any) => {
              if (prevMap) {
                prevMap.setView([latitude, longitude], mapUpdates.zoom || 14);
              }
              return prevMap;
            });
            if (mapUpdates.addMarker) {
              mapState.addSearchMarker({
                lat: latitude,
                lng: longitude,
                label: "Min posisjon",
              });
            }
          },
          (error) => {
            console.warn("Could not get location:", error);
          }
        );
      }

      // Clear the map updates after processing
      clearMapUpdates();
    }
    // Ensure all dependencies from mapState are included if necessary
  }, [
    mapUpdates,
    mapState.setMap,
    mapState.clearSearchMarkers,
    mapState.addSearchMarker,
    mapState.setSearchMarker,
    mapState.setUserMarker,
    clearMapUpdates,
  ]);

  // Manage interactions between modal and popover
  useEffect(() => {
    if (isFileDownloadModalOpen) {
      setModalOpen(true);
      // Ensure chatManagement.setBlockPopoverClose is stable or included
      chatManagement.setBlockPopoverClose(true);
    } else {
      const timer = setTimeout(() => {
        setModalOpen(false);
        chatManagement.setBlockPopoverClose(false);
      }, 100);
      return () => clearTimeout(timer);
    }
    // Ensure chatManagement.setBlockPopoverClose is stable or add it
  }, [isFileDownloadModalOpen, chatManagement.setBlockPopoverClose]);

  const handleChatSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmedInput = chatManagement.chatInput.trim(); // Use chatInput from hook
    if (trimmedInput && !isStreaming) {
      sendMessage(trimmedInput); // Use sendMessage from hook
      chatManagement.setChatInput(""); // Use setChatInput from hook
      setIsChatOpen(true);
      setIsLayerPanelOpen(false);
      setShowInitialInput(false);
    }
  };

  const openChatPanel = () => {
    setIsChatOpen(true);
    setIsLayerPanelOpen(false);
  };

  const openLayerPanel = () => {
    setIsLayerPanelOpen(true);
    setIsChatOpen(false);
  };

  // Create a wrapper function for handling WMS clicks from chat
  const handleWmsClickFromChat = (searchResult: SearchResult) => {
    // 1. Add the layer using the hook's function
    wmsManagement.addFirstWmsLayerFromSearchResult(
      searchResult,
      activeMapLayers,
      setActiveMapLayers
    );

    // 2. Open the Layer Panel
    setIsLayerPanelOpen(true);
    setIsChatOpen(false); // Optionally close chat panel

    // 3. Set the filter type to 'active'
    setLayerPanelFilter("active");

    // 4. Track the added dataset so LayerPanel can be updated
    setDatasetJustAddedFromChat(searchResult);
  };

  // New handler to toggle individual layers from LayerPanel
  const handleToggleLayerFromPanel = (
    layerInfo: ActiveLayerInfo,
    isChecked: boolean
  ) => {
    setActiveMapLayers((prevLayers) => {
      if (isChecked) {
        // Add layer if not already present
        if (!prevLayers.some((layer) => layer.id === layerInfo.id)) {
          return [...prevLayers, layerInfo];
        }
      } else {
        // Remove layer
        return prevLayers.filter((layer) => layer.id !== layerInfo.id);
      }
      return prevLayers; // Return unchanged state if no action needed
    });
  };

  // Create a memoized list of active layer IDs for LayerPanel prop
  const activeLayerIds = useMemo(
    () => activeMapLayers.map((layer) => layer.id),
    [activeMapLayers]
  );

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-gray-50 flex relative">
        {/* Left Sidebar */}
        <div
          className={`flex-shrink-0 max-h-screen z-10 transition-[width] duration-300 ${
            state === "collapsed" ? "w-0" : "w-[350px]"
          }`}
        >
          <AppSidebar
            availableLayers={wmsManagement.availableLayers ?? []}
            trackedDatasets={wmsManagement.trackedDatasets}
            onLayerChangeWithDataset={
              wmsManagement.handleLayerChangeWithDataset
            }
            onRemoveDataset={wmsManagement.removeTrackedDataset}
            onChangeBaseLayer={{
              revertToBaseMap,
              changeToGraattKart,
              changeToRasterKart,
              changeToSjoKart,
            }}
          />
        </div>

        {/* Main Content Area */}
        <div
          className={`flex-1 relative bg-gray-100 transition-all duration-300 ${
            isChatOpen || isLayerPanelOpen ? "mr-96" : ""
          }`}
        >
          <MapWithNoSSR
            center={[65.5, 13.5]}
            zoom={5}
            currentBaseLayer={currentBaseLayer}
            trackedDatasets={wmsManagement.trackedDatasets}
            wmsLayer={mapState.wmsLayer}
            userMarker={mapState.userMarker}
            searchMarker={mapState.searchMarker}
            searchMarkers={mapState.searchMarkers}
            setUserMarker={mapState.setUserMarker}
            setSearchMarker={mapState.setSearchMarker}
            onMapReady={mapState.handleMapReady}
            showAddressSearch={true}
            activeMapLayers={activeMapLayers}
          />

          <button className="absolute left-4 bottom-4 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 z-50">
            <HelpCircle className="w-6 h-6 text-gray-700" />
          </button>

          {/* Initial Chat Input - Repositioned */}
          {showInitialInput && !chatManagement.isFullScreen && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[600px] z-50 px-4">
              <div className="relative bg-white/80 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors duration-200">
                <input
                  type="text"
                  placeholder="Spør Kartassistent..."
                  value={chatManagement.chatInput}
                  onChange={(e) =>
                    chatManagement.handleChatInputChange(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleChatSubmit();
                    }
                  }}
                  className="w-full pl-4 pr-12 py-3 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleChatSubmit()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-orange-500 hover:text-orange-600"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {!chatManagement.isFullScreen && (
            <div className="absolute right-8 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-50">
              <button
                onClick={openChatPanel}
                className={`bg-white shadow-lg rounded-xl p-4 hover:bg-orange-50 transition-all duration-300 group ${
                  isChatOpen ? "bg-orange-50" : ""
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative">
                    <Image
                      src={hodetTilOmar}
                      alt="Hodet til Omar"
                      width={32}
                      height={32}
                      className="group-hover:rotate-45 transition-transform duration-300"
                    />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-800">Kartassistent</p>
                    <p className="text-xs text-gray-500">AI-drevet hjelp</p>
                  </div>
                </div>
              </button>
              <button
                onClick={openLayerPanel}
                className={`bg-white shadow-lg rounded-xl p-4 hover:bg-blue-50 transition-all duration-300 group ${
                  isLayerPanelOpen ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Database className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                  <div className="text-center">
                    <p className="font-medium text-gray-800">Kartkatalog</p>
                    <p className="text-xs text-gray-500">Datasett og API-er</p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Chat Panel - Use ChatWindow */}
        <div
          className={`fixed right-0 top-0 bottom-0 w-96 bg-white shadow-lg z-20 transition-transform duration-300 ${
            isChatOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {isChatOpen && (
            <ChatWindow
              messages={wsMessages}
              input={chatManagement.chatInput}
              onInputChange={chatManagement.handleChatInputChange}
              onSubmit={handleChatSubmit}
              isGenerating={isStreaming}
              onWmsClick={handleWmsClickFromChat}
              onDownloadClick={chatManagement.handleFullScreenDownload}
              onEnterFullScreen={chatManagement.enterFullScreen}
              onClose={() => setIsChatOpen(false)}
            />
          )}
        </div>

        <div
          className={`fixed right-0 top-0 bottom-0 w-96 bg-white shadow-lg z-20 transition-transform duration-300 ${
            isLayerPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">
                Kartkatalog
              </h2>
              <button
                onClick={() => setIsLayerPanelOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LayerPanel
                activeLayerIds={activeLayerIds}
                onToggleLayer={handleToggleLayerFromPanel}
                onDatasetDownload={executeDatasetDownload}
                filterType={layerPanelFilter}
                onFilterTypeChange={setLayerPanelFilter}
                // Pass the newly added dataset info
                newlyAddedDatasetInfo={datasetJustAddedFromChat}
              />
            </div>
          </div>
        </div>

        {/* Full Screen Chat UI */}
        {chatManagement.isFullScreen && (
          <FullScreenChatView
            messages={chatManagement.transformMessagesForChatKit()}
            chatInput={chatManagement.chatInput}
            isStreaming={isStreaming}
            suggestions={chatManagement.suggestions}
            handleInputChange={chatManagement.fullScreenHandleInputChange}
            handleSubmit={chatManagement.fullScreenHandleSubmit}
            handleAppend={chatManagement.handleAppend}
            onWmsClick={handleWmsClickFromChat}
            onDownloadClick={chatManagement.handleFullScreenDownload}
            exitFullScreen={chatManagement.exitFullScreen}
          />
        )}

        {/* Render the FileDownloadModal */}
        <FileDownloadModal
          isOpen={isFileDownloadModalOpen}
          handleClose={handleModalClose}
          handleConfirmSelection={confirmDownload}
          handleStandardDownload={handleStandardDownload}
          geographicalAreas={geographicalAreas}
          projections={projections}
          formats={formats}
          datasetName={specificObject?.title || ""} // Use specificObject from hook
          onAreaChange={handleAreaChange}
          metadataUuid={specificObject?.uuid || ""} // Use specificObject from hook
        />
      </div>
    </LanguageProvider>
  );
};

export default DemoV4;
