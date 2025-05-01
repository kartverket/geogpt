import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chat as FullScreenChat, DownloadInfo } from "@/components/ui/chat";
import GeoNorgeIcon from "@/components/ui/GeoNorgeIcon";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface FullScreenChatViewProps {
  messages: ChatMessage[];
  chatInput: string;
  isStreaming: boolean;
  suggestions: string[];
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  handleAppend: (message: { role: "user"; content: string }) => void;
  onWmsClick: (wmsUrl: string, datasetTitle?: string) => void;
  onDownloadClick: (info: DownloadInfo) => void;
  exitFullScreen: () => void;
}

const FullScreenChatView: React.FC<FullScreenChatViewProps> = ({
  messages,
  chatInput,
  isStreaming,
  suggestions,
  handleInputChange,
  handleSubmit,
  handleAppend,
  onWmsClick,
  onDownloadClick,
  exitFullScreen,
}) => {
  return (
    <div className="fixed inset-0 z-[50] bg-white flex flex-col">
      <div className="flex justify-between items-center p-4 border-b container mx-auto">
        <div className="flex items-center">
          <GeoNorgeIcon />
          <h2 className="text-xl font-bold ml-2">GeoGPT</h2>
        </div>
        <Button
          variant="outline"
          onClick={exitFullScreen}
          className="group flex items-center justify-between hover:bg-gray-100 transition-colors duration-200 rounded-md px-3 py-2"
          aria-label="Forlat fullskjerm"
        >
          <div className="flex items-center gap-3">
            <LogOut
              size={16}
              className="text-gray-500 group-hover:text-gray-700 transition-colors"
            />
            <span className="font-medium">Forlat fullskjerm</span>
          </div>
        </Button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <FullScreenChat
          messages={messages}
          handleSubmit={handleSubmit}
          input={chatInput}
          handleInputChange={handleInputChange}
          isGenerating={isStreaming}
          stop={() => {}}
          append={handleAppend}
          suggestions={suggestions}
          onWmsClick={onWmsClick}
          onDownloadClick={onDownloadClick}
          onExitFullScreen={exitFullScreen}
          className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-end mb-10"
        />
      </div>
    </div>
  );
};

export default FullScreenChatView;
