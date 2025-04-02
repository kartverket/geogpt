import { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Maximize, X } from "lucide-react";
import { ChatMessage as ChatMessageType } from "./types";
import GeoNorgeIcon from "../../../components/ui/GeoNorgeIcon";
import { TypingIndicator } from "@/components/ui/typing-indicator";

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="px-4 py-2 flex justify-between items-center border-b">
        <div className="flex items-center">
          <GeoNorgeIcon />
          <span className="font-bold text-lg ml-2">GeoGPT</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEnterFullScreen}>
            <Maximize />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="px-4"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <div id="chatMessages" className="flex-1 p-4 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">
            Hei! Jeg er GeoGPT. Spør meg om geodata!
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
