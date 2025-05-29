import { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Maximize, X } from "lucide-react";
import { ChatMessage as ChatMessageType, SearchResult } from "./types";
import GeoNorgeIcon from "../../../components/ui/GeoNorgeIcon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

interface ChatWindowProps {
  messages: ChatMessageType[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (
    e?: React.FormEvent<HTMLFormElement>,
    examplePrompt?: string
  ) => void;
  isGenerating: boolean;
  onWmsClick: (searchResult: SearchResult) => void;
  onDownloadClick: (info: SearchResult) => void;
  onEnterFullScreen: () => void;
  onClose: () => void;
}

const examplePrompts = [
  "Hvilke datasett er tilgjengelig for flomdata?",
  "Vis meg eiendomsgrenser for Gjøvik",
  "Jeg trenger informasjon om høydekart for Oslo",
  "Er det kvikkleire rundt min posisjon?",
];

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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleExamplePromptClick = (prompt: string) => {
    onSubmit(undefined, prompt);
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-xl border border-gray-200"
      id={TOUR_STEP_IDS.CHAT_INTERFACE}
    >
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200">
        <div className="flex items-center">
          <GeoNorgeIcon className="w-8 h-8" />
          <span className="font-bold text-xl ml-3 text-gray-800">GeoGPT</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEnterFullScreen}>
            <Maximize />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="px-3"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div id="chatMessages" className="p-6 space-y-4">
          {messages.length === 0 && (
            <>
              <div className="text-center py-8">
                <GeoNorgeIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  Hei! Jeg er GeoGPT.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Still meg spørsmål om geodata, eller prøv et av forslagene
                  under.
                </p>
                <div className="space-y-2">
                  {examplePrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full text-left justify-start text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-gray-300"
                      onClick={() => handleExamplePromptClick(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </>
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
      </ScrollArea>

      <ChatInput
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onSubmit={onSubmit}
        isStreaming={isGenerating}
      />
    </div>
  );
};
