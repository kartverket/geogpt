"use client";

import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react"; // Fixed: Added X icon import
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";

// Dynamically import MapContainer to avoid SSR issues
const MapWithNoSSR = dynamic(() => import("@/app/components/map-wrapper"), {
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

  const [showInitialTooltip, setShowInitialTooltip] = useState(false);

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

  // Show tooltip on mount for 30 seconds
  useEffect(() => {
    setShowInitialTooltip(true);

    const timer = setTimeout(() => {
      setShowInitialTooltip(false);
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

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
              <TooltipProvider delayDuration={100}>
                <Tooltip
                  defaultOpen={showInitialTooltip}
                  open={showInitialTooltip ? true : undefined}
                >
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        className="fixed bottom-6 right-8 bg-color-gn-primary hover:bg-color-gn-primarylight rounded-full p-0 h-16 w-16 flex items-center justify-center shadow-lg z-[1000]"
                        variant="default"
                        onMouseEnter={() => !showInitialTooltip && undefined}
                      >
                        <div
                          className={`transition-transform duration-300 ${
                            chatManagement.isPopoverOpen ? "rotate-90" : ""
                          }`}
                        >
                          {chatManagement.isPopoverOpen ? (
                            <X className="h-auto w-auto" />
                          ) : (
                            <MessageSquare className="h-auto w-auto" />
                          )}
                        </div>
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    className="px-4 py-2 z-10 text-sm font-semibold bg-white text-color-gn-secondary shadow-md rounded-lg border border-gray-100"
                    side="left"
                    sideOffset={16}
                    align="center"
                  >
                    <span className="flex items-center gap-3">
                      <span className="whitespace-nowrap">
                        Trenger du hjelp med noe?
                      </span>
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
