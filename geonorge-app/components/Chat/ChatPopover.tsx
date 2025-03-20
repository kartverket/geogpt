import React, { useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Maximize, MessageSquare, Send, X } from "lucide-react";
import GeoNorgeIcon from "@/app/components/images/GeoNorgeIcon";
import { ChatMessage } from "@/types/chat";

interface ChatPopoverProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  isChatStreaming: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onEnterFullScreen: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  onDatasetDownload: (msg: ChatMessage) => void;
  onReplaceIframe: (wmsUrl: any, title?: string) => void;
  blockPopoverClose: boolean;
}

export function ChatPopover({
  isOpen,
  setIsOpen,
  chatMessages,
  chatInput,
  setChatInput,
  isChatStreaming,
  onSubmit,
  onEnterFullScreen,
  chatEndRef,
  onDatasetDownload,
  onReplaceIframe,
  blockPopoverClose,
}: ChatPopoverProps) {
  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !blockPopoverClose) {
          setIsOpen(false);
        } else if (open) {
          setIsOpen(true);
        }
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <Button
          className="fixed bottom-6 right-10 bg-[#FE642F] hover:bg-[#f35a30] rounded-full p-0 h-16 w-16 flex items-center justify-center shadow-lg z-[1000]"
          variant="default"
        >
          <MessageSquare className="h-auto w-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[450px] h-[30rem] z-[401] p-0 overflow-hidden shadow-lg rounded-lg"
      >
        <div className="flex flex-col h-full bg-white">
          <div className="px-4 py-2 flex justify-between items-center border-b">
            <div className="flex items-center">
              <GeoNorgeIcon />
              <span className="font-bold text-lg ml-2">GeoGPT</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEnterFullScreen}
              >
                <Maximize />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="px-4"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div
            id="chatMessages"
            className="flex-1 p-4 overflow-y-auto space-y-2"
          >
            <div className="text-sm text-gray-500">
              Hei! Jeg er GeoGPT. Spør meg om geodata!
            </div>
            {chatMessages.map((msg, idx) => {
              if (msg.type === "image" && msg.imageUrl) {
                return (
                  <div
                    key={idx}
                    className="flex flex-col space-y-2 my-2"
                  >
                    <Image
                      src={msg.imageUrl || "/placeholder.svg"}
                      alt="Dataset"
                      className="max-w-full h-auto rounded"
                      width={400}
                      height={300}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (msg.wmsUrl && msg.wmsUrl !== "None") {
                            onReplaceIframe(msg.wmsUrl);
                            console.log(msg.wmsUrl);
                          }
                        }}
                        className={`text-xs ${
                          msg.wmsUrl && msg.wmsUrl !== "None"
                            ? "rounded-[2px] bg-[#FF8B65] hover:bg-[#FE642F] text-white"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                        disabled={!msg.wmsUrl || msg.wmsUrl === "None"}
                      >
                        Vis
                      </Button>
                      {msg.downloadUrl && (
                        <Button
                          onClick={() => onDatasetDownload(msg)}
                          className="rounded-[2px] bg-[#404041] hover:bg-[#5c5c5d] text-white text-xs"
                        >
                          Last ned datasett
                        </Button>
                      )}
                    </div>
                  </div>
                );
              } else {
                let content = msg.content || "";
                let isUser = false;
                if (content.startsWith("You: ")) {
                  isUser = true;
                  content = content.slice("You: ".length);
                } else if (content.startsWith("System: ")) {
                  content = content.slice("System: ".length);
                }
                content = content.replace(
                  /\*\*(.*?)\*\*/g,
                  "<strong>$1</strong>"
                );
                return (
                  <div
                    key={idx}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-2 rounded text-sm whitespace-pre-wrap ${
                        isUser ? "bg-orange-100" : "bg-gray-100"
                      }`}
                    >
                      {isUser ? (
                        <strong>You:</strong>
                      ) : (
                        <strong>System:</strong>
                      )}
                      <span
                        className="ml-1"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    </div>
                  </div>
                );
              }
            })}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center border-t border-gray-300 p-2 pb-3"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Spør GeoGPT..."
              className="flex-1 rounded px-2 py-2 text-sm focus:outline-none"
            />
            <Button
              type="submit"
              disabled={isChatStreaming || !chatInput.trim()}
              className="w-10"
            >
              <Send />
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
