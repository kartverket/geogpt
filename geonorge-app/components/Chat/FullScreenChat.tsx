import React from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/ui/chat";
import GeoNorgeIcon from "@/app/components/images/GeoNorgeIcon";
import { FullScreenChatMessage } from "@/types/chat";

interface FullScreenChatProps {
  messages: FullScreenChatMessage[];
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isGenerating: boolean;
  stop: () => void;
  append: (message: { role: "user"; content: string }) => void;
  suggestions: string[];
  onWmsClick: (wmsUrl: any) => void;
  onDownloadClick: (url: string) => void;
  onExitFullScreen: () => void;
}

export function FullScreenChat({
  messages,
  handleSubmit,
  input,
  handleInputChange,
  isGenerating,
  stop,
  append,
  suggestions,
  onWmsClick,
  onDownloadClick,
  onExitFullScreen,
}: FullScreenChatProps) {
  return (
    <div className="fixed inset-0 z-[401] bg-white">
      <div className="flex justify-between items-center p-4 border-b container mx-auto">
        <div className="flex items-center">
          <GeoNorgeIcon />
          <h2 className="text-xl font-bold ml-2">GeoGPT</h2>
        </div>
        <Button
          variant="outline"
          onClick={onExitFullScreen}
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
        <Chat
          messages={messages}
          handleSubmit={handleSubmit}
          input={input}
          handleInputChange={handleInputChange}
          isGenerating={isGenerating}
          stop={stop}
          append={append}
          suggestions={suggestions}
          onWmsClick={onWmsClick}
          onDownloadClick={onDownloadClick}
          onExitFullScreen={onExitFullScreen}
          className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-end"
        />
      </div>
    </div>
  );
}
