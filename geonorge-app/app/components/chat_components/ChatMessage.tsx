import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChatMessage as ChatMessageType, SearchResult } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
  onWmsClick: (searchResult: SearchResult) => void;
  onDownloadClick: (url: string) => void;
}

export const ChatMessage = ({
  message,
  onWmsClick,
  onDownloadClick,
}: ChatMessageProps) => {
  if (message.type === "image" && message.imageUrl) {
    return (
      <div className="flex flex-col space-y-2 my-2">
        <Image
          src={message.imageUrl || "/placeholder.svg"}
          alt="Dataset"
          className="max-w-full h-auto rounded"
          width={400}
          height={300}
        />
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const wmsInfo = message.wmsUrl;
              if (
                wmsInfo &&
                wmsInfo !== "None" &&
                typeof wmsInfo === "object" &&
                "wms_url" in wmsInfo &&
                wmsInfo.wms_url &&
                wmsInfo.wms_url !== "None"
              ) {
                const searchResult: SearchResult = {
                  uuid: message.uuid || `msg-${Date.now()}`,
                  title: message.title || "Ukjent datasett",
                  wmsUrl: wmsInfo,
                  downloadUrl: message.downloadUrl || null,
                };
                onWmsClick(searchResult);
              } else {
                console.warn(
                  "WMS data missing or in unexpected format on message:",
                  message
                );
              }
            }}
            className={`text-xs ${
              message.wmsUrl &&
              message.wmsUrl !== "None" &&
              typeof message.wmsUrl === "object" &&
              "wms_url" in message.wmsUrl &&
              message.wmsUrl.wms_url &&
              message.wmsUrl.wms_url !== "None"
                ? "rounded-omar bg-color-gn-primarylight hover:bg-color-gn-primary text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            disabled={
              !(
                message.wmsUrl &&
                message.wmsUrl !== "None" &&
                typeof message.wmsUrl === "object" &&
                "wms_url" in message.wmsUrl &&
                message.wmsUrl.wms_url &&
                message.wmsUrl.wms_url !== "None"
              )
            }
          >
            Vis
          </Button>
          {message.downloadUrl && (
            <Button
              onClick={() => onDownloadClick(message.downloadUrl!)}
              className="rounded-omar bg-color-gn-secondary hover:bg-[#5c5c5d] text-white text-xs"
            >
              Last ned datasett
            </Button>
          )}
        </div>
      </div>
    );
  }

  let content = message.content || "";
  let isUser = false;
  if (content.startsWith("You: ")) {
    isUser = true;
    content = content.slice("You: ".length);
  } else if (content.startsWith("System: ")) {
    content = content.slice("System: ".length);
  }
  content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] p-2 rounded text-sm whitespace-pre-wrap ${
          isUser ? "bg-orange-100" : "bg-gray-100"
        }`}
      >
        <span dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
};
