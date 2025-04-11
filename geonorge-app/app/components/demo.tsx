"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";

// Custom Hooks
import { useWebSocket } from "./chat_components/useWebSocket";
import { useWmsManagement } from "@/hooks/useWmsManagement";
import { useBaseLayerManagement } from "@/hooks/useBaseLayerManagement";
import { useDownloadManagement } from "@/hooks/useDownloadManagement";
import { useChatManagement } from "@/hooks/useChatManagement";
import { useMapState } from "@/hooks/useMapState";
import { useTour } from "@/components/tour";

import { AppSidebar } from "@/app/components/app-sidebar";
import { KartkatalogTab } from "@/app/components/kartkatalog-tab";
import FileDownloadModal from "@/app/components/FileDownloadModal/FileDownloadModal";
import FullScreenChatView from "@/app/components/chat_components/FullScreenChatView";
import { ChatWindow } from "./chat_components";
import DuplicateDatasetModal from "./multipleDasetModal";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// Dynamically import MapContainer to avoid SSR issues
const MapWithNoSSR = dynamic(() => import("@/components/map-wrapper"), {
  ssr: false,
});

const DemoV3 = () => {
  // Use our custom hooks
  const mapState = useMapState();
  const {
    currentBaseLayer,
    revertToBaseMap,
    changeToGraattKart,
    changeToRasterKart,
    changeToSjoKart,
  } = useBaseLayerManagement();

  const {
    availableLayers,
    trackedDatasets,
    isDuplicateAlertOpen,
    duplicateDatasetTitle,
    setIsDuplicateAlertOpen,
    replaceIframe,
    removeTrackedDataset,
    handleLayerChangeWithDataset,
  } = useWmsManagement();

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

  // WebSocket state
  const [modalOpen, setModalOpen] = useState(false);

  // Use the WebSocket hook
  const { messages, isStreaming, sendMessage, ws, mapUpdates } = useWebSocket();

  // Use chat management hook
  const chatManagement = useChatManagement({
    messages,
    isStreaming,
    sendMessage,
    executeDatasetDownload,
    replaceIframe,
  });

  const { currentStep } = useTour();

  // Handle map updates from WebSocket
  useEffect(() => {
    if (mapUpdates) {
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
        // First, clear existing markers
        mapState.clearSearchMarkers();

        // If there are markers in the update, add them
        if (mapUpdates.markers && mapUpdates.markers.length > 0) {
          // Add all markers from the update
          mapUpdates.markers.forEach((marker) => {
            mapState.addSearchMarker({
              lat: marker.lat,
              lng: marker.lng,
              label: marker.label,
            });
          });

          // If there's only one marker, we can also set it as the searchMarker for backward compatibility
          if (mapUpdates.markers.length === 1) {
            const marker = mapUpdates.markers[0];
            mapState.setSearchMarker({
              lat: marker.lat,
              lng: marker.lng,
            });
          }
        } else {
          // If markers array is empty, also clear the single searchMarker
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
              // Add a marker at user's location if requested
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
    }
  }, [mapUpdates]);

  // Manage interactions between modal and popover
  useEffect(() => {
    if (isFileDownloadModalOpen) {
      setModalOpen(true);
      chatManagement.setBlockPopoverClose(true);
    } else {
      // When modal closes, allow a small delay before popover can close
      const timer = setTimeout(() => {
        setModalOpen(false);
        chatManagement.setBlockPopoverClose(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFileDownloadModalOpen]);
  // VÆR FORSIKTIG MED Å BRUKE CHATMANAGEMENT, KAN LAGE INFINITE LOOP

  // Effect to control popover open state based on tour step
  useEffect(() => {
    console.log("currentStep", currentStep);
    console.log(
      "chatManagement.blockPopoverClose",
      chatManagement.blockPopoverClose
    );
    if (currentStep === 0 || currentStep === 1 || currentStep === 2) {
      // Open popover for initial tour steps if not already open
      if (!chatManagement.isPopoverOpen) {
        chatManagement.setIsPopoverOpen(true);
      }
    } else if (currentStep === 3) {
      // Explicitly close the popover when reaching step 3 (Kartkatalog)
      if (chatManagement.isPopoverOpen) {
        chatManagement.setIsPopoverOpen(false);
      }
    }
  }, [
    currentStep,
    chatManagement.isPopoverOpen,
    chatManagement.setIsPopoverOpen,
  ]);

  // Effect to control popover closing block based on tour step
  useEffect(() => {
    const shouldBeBlocked = currentStep !== -1;
    if (chatManagement.blockPopoverClose !== shouldBeBlocked) {
      chatManagement.setBlockPopoverClose(shouldBeBlocked);
    }
  }, [
    currentStep,
    chatManagement.blockPopoverClose,
    chatManagement.setBlockPopoverClose,
  ]);

  // Chat popover props
  const chatPopoverProps = {
    open: chatManagement.isPopoverOpen,
    onOpenChange: (open: boolean) => {
      // Only allow state changes if not blocked
      if (!chatManagement.blockPopoverClose) {
        chatManagement.setIsPopoverOpen(open);
      }
    },
  };

  return (
    <>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <div className="relative flex-1">
          {/* Map container */}
          <div className="absolute inset-0 z-0" id="map">
            <MapWithNoSSR
              center={[65.5, 13.5]}
              zoom={5}
              currentBaseLayer={currentBaseLayer}
              trackedDatasets={trackedDatasets}
              wmsLayer={mapState.wmsLayer}
              userMarker={mapState.userMarker}
              searchMarker={mapState.searchMarker}
              searchMarkers={mapState.searchMarkers}
              setUserMarker={mapState.setUserMarker}
              setSearchMarker={mapState.setSearchMarker}
              onMapReady={mapState.handleMapReady}
              showAddressSearch={true}
            />

            {/* KartkatalogTab */}
            <div className="fixed top-[25%] right-0 -translate-y-0 max-h-[450px]">
              <KartkatalogTab
                onReplaceIframe={replaceIframe}
                onDatasetDownload={executeDatasetDownload}
                ws={ws}
              />
            </div>

            {/* Chat popover */}
            <Popover {...chatPopoverProps}>
              <PopoverTrigger asChild>
                <Button
                  className="fixed bottom-6 right-10 bg-color-gn-primary hover:bg-color-gn-primarylight rounded-full p-0 h-16 w-16 flex items-center justify-center shadow-lg z-[1000]"
                  variant="default"
                >
                  <MessageSquare className="h-auto w-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-[450px] h-[30rem] p-0 overflow-hidden shadow-lg rounded-lg"
              >
                <ChatWindow
                  messages={messages}
                  input={chatManagement.chatInput}
                  onInputChange={chatManagement.handleChatInputChange}
                  onSubmit={chatManagement.onChatSubmit}
                  isGenerating={isStreaming}
                  onWmsClick={replaceIframe}
                  onDownloadClick={chatManagement.handleFullScreenDownload}
                  onEnterFullScreen={chatManagement.enterFullScreen}
                  onClose={() => chatManagement.setIsPopoverOpen(false)}
                />
              </PopoverContent>
            </Popover>
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
            onWmsClick={replaceIframe}
            onDownloadClick={chatManagement.handleFullScreenDownload}
            exitFullScreen={chatManagement.exitFullScreen}
          />
        )}

        <AppSidebar
          availableLayers={availableLayers ?? []}
          trackedDatasets={trackedDatasets}
          onLayerChangeWithDataset={handleLayerChangeWithDataset}
          onRemoveDataset={removeTrackedDataset}
          onChangeBaseLayer={{
            revertToBaseMap,
            changeToGraattKart,
            changeToRasterKart,
            changeToSjoKart,
          }}
          setSearchMarker={mapState.setSearchMarker}
          className="z-40"
        />

        <FileDownloadModal
          isOpen={isFileDownloadModalOpen}
          handleClose={handleModalClose}
          handleConfirmSelection={confirmDownload}
          handleStandardDownload={handleStandardDownload}
          geographicalAreas={geographicalAreas}
          projections={projections}
          formats={formats}
          datasetName={specificObject?.title || ""}
          onAreaChange={handleAreaChange}
          metadataUuid={specificObject?.uuid || ""}
        />

        <DuplicateDatasetModal
          isOpen={isDuplicateAlertOpen}
          onClose={() => setIsDuplicateAlertOpen(false)}
          datasetTitle={duplicateDatasetTitle}
        />
      </div>
    </>
  );
};

export default DemoV3;
