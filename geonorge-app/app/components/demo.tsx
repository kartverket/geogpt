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
  const { messages, isStreaming, sendMessage, ws } = useWebSocket();

  // Use chat management hook
  const chatManagement = useChatManagement({
    messages,
    isStreaming,
    sendMessage,
    executeDatasetDownload,
    replaceIframe,
  });

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
  }, [isFileDownloadModalOpen, chatManagement]);

  // Chat popover props
  const chatPopoverProps = {
    open: chatManagement.isPopoverOpen,
    onOpenChange: chatManagement.setIsPopoverOpen,
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
              setUserMarker={mapState.setUserMarker}
              setSearchMarker={mapState.setSearchMarker}
              onMapReady={mapState.handleMapReady}
              showAddressSearch={true}
            />

            {/* KartkatalogTab */}
            <div className="fixed top-[25%] right-0 -translate-y-0 z-[401] max-h-[450px]">
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

        <div className="z-40">
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
          />
        </div>

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
