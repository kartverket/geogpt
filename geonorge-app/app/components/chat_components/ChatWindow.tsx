import { useRef, useEffect, useState } from "react";
// Compontents
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
// UI Components
import { Button } from "@/components/ui/button";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import GeoNorgeIcon from "@/components/ui/GeoNorgeIcon";

// Icons
import {
  Maximize,
  X,
  Search,
  Database,
  Sparkles,
  MessageCircleQuestion,
} from "lucide-react";

// Lib
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

// Types
import { ChatMessage as ChatMessageType } from "./types";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatWindowProps {
  messages: ChatMessageType[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isGenerating: boolean;
  onWmsClick: (url: string, title?: string) => void;
  onDownloadClick: (url: string) => void;
  onEnterFullScreen: () => void;
  onClose: () => void;
}

// Keep as named export, don't change to default export
export const ChatWindow = ({
  messages,
  input,
  onInputChange,
  onSubmit,
  isGenerating,
  onWmsClick,
  onDownloadClick,
  onEnterFullScreen,
  onClose,
}: ChatWindowProps) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showTooltips, setShowTooltips] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Delay enabling tooltips to prevent them from showing on initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltips(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-lg"
      id={TOUR_STEP_IDS.CHAT_INTERFACE}
    >
      <div className="px-4 py-3 flex justify-between items-center border-b ">
        <div className="flex items-center">
          <div className="flex items-center mr-2"></div>
          <GeoNorgeIcon />
          <span className="text-color-gn-secondary space-x-4 ml-4 text-md font-semibold text-lg">
            GeoGPT
          </span>
        </div>
        <div className="flex gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip open={showTooltips ? undefined : false}>
              <TooltipTrigger asChild>
                <Button
                  className="text-color-gn-secondary hover:bg-gray-100"
                  variant="ghost"
                  size="sm"
                  tabIndex={-1}
                  onClick={onEnterFullScreen}
                >
                  <Maximize size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Fullskjerm</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip open={showTooltips ? undefined : false}>
              <TooltipTrigger asChild>
                <Button
                  className="text-color-gn-secondary hover:bg-gray-100"
                  variant="ghost"
                  size="sm"
                  tabIndex={-1}
                  onClick={onClose}
                >
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Lukk</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div id="chatMessages" className="flex-1 p-4 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="text-center max-w-sm mx-auto">
            <div className="flex justify-center mb-2">
              <div className="bg-color-gn-primary rounded-full p-3">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-color-gn-secondary mb-2">
              Velkommen til GeoGPT
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Jeg kan hjelpe deg med å finne og utforske geografisk informasjon
            </p>

            <div className="text-left text-sm bg-gray-50 p-4 rounded-lg border border-gray-100 mr-4 ml-4">
              <div className="flex items-center mb-4">
                <Search className="h-5 w-5 text-color-gn-primary mr-3 ml-4" />
                <span className="text-gray-700">
                  Søke etter datasett og karttjenester
                </span>
              </div>

              <div className="flex items-center mb-4">
                <Database className="h-5 w-5 text-color-gn-primary mr-3 ml-4" />
                <span className="text-gray-700">
                  Finne geografisk informasjon og GIS-data
                </span>
              </div>

              <div className="flex items-center">
                <MessageCircleQuestion className="h-5 w-5 text-color-gn-primary mr-3 ml-4" />
                <span className="text-gray-700">
                  Besvare spørsmål om kart og geodata
                </span>
              </div>
            </div>

            <p className="text-sm mt-4 text-gray-500">
              Skriv et spørsmål i feltet under for å komme i gang
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            onWmsClick={onWmsClick}
            onDownloadClick={onDownloadClick}
          />
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <ChatInput
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onSubmit={onSubmit}
        isStreaming={isGenerating}
      />
    </div>
  );
};
