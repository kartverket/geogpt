"use client";

import "leaflet/dist/leaflet.css";

// Custom hooks
import { useMap } from "@/hooks/useMap";
import { useWmsLayers } from "@/hooks/useWmsLayers";
import { useChat } from "@/hooks/useChat";
import { useDatasets } from "@/hooks/useDatasets";

// Components
import { MapContainer } from "@/components/Map/MapContainer";
import { AddressSearch } from "@/components/Search/AddressSearch";
import { ChatPopover } from "@/components/Chat/ChatPopover";
import { FullScreenChat } from "@/components/Chat/FullScreenChat";
import FileDownloadModal from "@/app/components/FileDownloadModal/FileDownloadModal";

const DemoV3 = () => {
  // Initialize map functionality
  const { mapState, selectAddress } = useMap();
  
  // Initialize WMS layer functionality
  const {
    replaceIframe,
  } = useWmsLayers(mapState.map);
  
  // Initialize chat functionality
  const {
    ws,
    chatMessages,
    chatInput,
    setChatInput,
    isChatStreaming,
    isFullScreen,
    isPopoverOpen,
    setIsPopoverOpen,
    chatEndRef,
    isFileDownloadModalOpen,
    setFileDownloadModalOpen,
    pendingDownloadUrl,
    specificObject,
    geographicalAreas,
    projections,
    formats,
    blockPopoverClose,
    onChatSubmit: originalChatSubmit,
    fullScreenHandleSubmit,
    fullScreenHandleInputChange,
    transformMessagesForChatKit,
    handleAppend,
    handleDatasetDownload,
    handleFullScreenDownload,
    handleDirectDownload,
    enterFullScreen,
    exitFullScreen,
  } = useChat(replaceIframe);
  
  // Initialize datasets functionality
  const {
    handleAreaChange,
  } = useDatasets();

  // Suggestions for the full screen chat
  const suggestions = [
    "Hva er FKB?",
    "Hvilke datasett er nyttige for byggesaksbehandlere?",
    "Er det kvikkleire der jeg bor?",
  ];

  // Confirm download from modal
  const confirmDownload = () => {
    if (!pendingDownloadUrl) return;
    handleDirectDownload(pendingDownloadUrl);
    setFileDownloadModalOpen(false);
  };

  // Handle standard download when no selections are made
  const handleStandardDownload = () => {
    if (pendingDownloadUrl) {
      handleDirectDownload(pendingDownloadUrl);
    }
  };

  // Update the modal close handler
  const handleModalClose = () => {
    setFileDownloadModalOpen(false);
  };
  
  // Wrapper function to handle type compatibility
  const onChatSubmit = (e: React.FormEvent<Element>) => {
    originalChatSubmit(e as React.FormEvent<HTMLFormElement>);
  };

  return (
    <>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <div className="relative flex-1">
          <AddressSearch onSelectAddress={selectAddress} />

          <MapContainer ws={ws}>
            <ChatPopover
              isOpen={isPopoverOpen}
              setIsOpen={setIsPopoverOpen}
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              isChatStreaming={isChatStreaming}
              onSubmit={onChatSubmit}
              onEnterFullScreen={enterFullScreen}
              chatEndRef={chatEndRef}
              onDatasetDownload={handleDatasetDownload}
              onReplaceIframe={replaceIframe}
              blockPopoverClose={blockPopoverClose}
            />
          </MapContainer>
        </div>

        {/* Full Screen Chat UI */}
        {isFullScreen && (
          <FullScreenChat
            messages={transformMessagesForChatKit()}
            handleSubmit={fullScreenHandleSubmit}
            input={chatInput}
            handleInputChange={fullScreenHandleInputChange}
            isGenerating={false}
            stop={() => {}}
            append={handleAppend}
            suggestions={suggestions}
            onWmsClick={replaceIframe}
            onDownloadClick={handleFullScreenDownload}
            onExitFullScreen={exitFullScreen}
          />
        )}

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
      </div>
    </>
  );
};

export default DemoV3;
