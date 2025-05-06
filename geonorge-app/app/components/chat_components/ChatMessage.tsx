import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChatMessage as ChatMessageType, SearchResult } from "./types";
import { Download, Eye } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";

interface ChatMessageProps {
  message: ChatMessageType;
  onWmsClick: (searchResult: SearchResult) => void;
  onDownloadClick: (info: SearchResult) => void;
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
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    variant="show"
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
                          downloadFormats: message.downloadFormats || [],
                        };
                        onWmsClick(searchResult);
                      } else {
                        console.warn(
                          "WMS data missing or in unexpected format on message:",
                          message
                        );
                      }
                    }}
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
                    <Eye className="h-4 w-4 mr-2" />
                    Vis på kart
                  </Button>
                </div>
              </TooltipTrigger>
              {!(
                message.wmsUrl &&
                message.wmsUrl !== "None" &&
                typeof message.wmsUrl === "object" &&
                "wms_url" in message.wmsUrl &&
                message.wmsUrl.wms_url &&
                message.wmsUrl.wms_url !== "None"
              ) && (
                <TooltipContent className="bg-white p-2 shadow-md rounded border text-sm">
                  <p>WMS URL er ikke tilgjengelig for dette datasettet</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {message.downloadUrl && (
            <Button
              variant="download"
              onClick={() => {
                const downloadInfo: SearchResult = {
                  uuid: message.uuid || `msg-${Date.now()}`,
                  title: message.title || "Ukjent datasett",
                  downloadUrl: message.downloadUrl!,
                  downloadFormats: message.downloadFormats || [],
                  wmsUrl:
                    message.wmsUrl && typeof message.wmsUrl === "object"
                      ? message.wmsUrl
                      : undefined,
                };
                onDownloadClick(downloadInfo);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] p-3 rounded-md text-sm break-words ${
          isUser ? "bg-orange-50" : "bg-gray-100"
        }`}
      >
        <div className="chat-content">
          <MarkdownRenderer>{content}</MarkdownRenderer>
        </div>
      </div>
    </div>
  );
};
