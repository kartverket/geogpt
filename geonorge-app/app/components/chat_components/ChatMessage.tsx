import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChatMessage as ChatMessageType } from "./types";
import { Download, Eye } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";

interface ChatMessageProps {
  message: ChatMessageType;
  onWmsClick: (url: string, title?: string) => void;
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
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    variant="show"
                    onClick={() => {
                      if (message.wmsUrl && message.wmsUrl !== "None") {
                        onWmsClick(message.wmsUrl, message.title);
                      }
                    }}
                    className={` ${
                      message.wmsUrl && message.wmsUrl !== "None" ? "" : ""
                    }`}
                    disabled={!message.wmsUrl || message.wmsUrl === "None"}
                  >
                    {(!message.wmsUrl || message.wmsUrl === "None") && (
                      <Eye className="h-4 w-4" />
                    )}
                    Vis på kart
                  </Button>
                </div>
              </TooltipTrigger>
              {(!message.wmsUrl || message.wmsUrl === "None") && (
                <TooltipContent className="bg-white p-2 shadow-md rounded border text-sm">
                  <p>WMS URL er ikke tilgjengelig for dette datasettet</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {message.downloadUrl && (
            <Button
              variant="download"
              onClick={() => onDownloadClick(message.downloadUrl!)}
            >
              <Download className="h-4 w-4" />
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
          isUser ? "bg-orange-50" : "bg-gray-100"
        }`}
      >
        <span dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
};
