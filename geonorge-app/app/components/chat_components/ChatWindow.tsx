import { useRef, useEffect, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import {
  Maximize,
  X,
  Search,
  Database,
  Sparkles,
  MessageCircleQuestion,
} from "lucide-react";
import { ChatMessage as ChatMessageType } from "./types";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import GeoNorgeIcon from "@/components/ui/GeoNorgeIcon";
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
          <div className="text-center max-w-md mx-auto">
            <div className="flex justify-center mb-2">
              <div className="bg-color-gn-primarylight rounded-full p-3">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="mb-2">
              <h3 className="text-xl font-medium text-color-gn-secondary">
                Velkommen til GeoGPT
              </h3>
              <p className="text-sm text-indigo-500 mb-4">
                KI-drevet Kartassistent
              </p>
            </div>
            <p className="text-gray-700 mb-2 text-sm font-semibold">
              Jeg kan hjelpe deg med å:
            </p>
            <ul className="text-left text-sm text-gray-700 space-y-2 mb-2">
              <li className="flex items-center ml-9">
                <div className="bg-color-gn-primarylight rounded-md p-1.5 flex items-center justify-center mr-3 shrink-0">
                  <Search className="h-5 w-5 text-white" />
                </div>
                <span>Søke etter datasett og karttjenester</span>
              </li>
              <li className="flex items-center ml-9">
                <div className="bg-color-gn-primarylight rounded-md p-1.5 flex items-center justify-center mr-3 shrink-0">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <span>Finne geografisk informasjon og GIS-data</span>
              </li>
              <li className="flex items-center ml-9">
                <div className="bg-color-gn-primarylight rounded-md p-1.5 flex items-center justify-center mr-3 shrink-0">
                  <MessageCircleQuestion className="h-5 w-5 text-white" />
                </div>
                <span>Besvare spørsmål om kart og geografiske data</span>
              </li>
            </ul>
            <p className="text-sm mt-4 text-gray-500 italic">
              Still meg et spørsmål om geodata for å komme i gang!
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
