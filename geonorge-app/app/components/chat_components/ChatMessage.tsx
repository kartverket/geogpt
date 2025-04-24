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
  // Helper function to ensure URLs start with https
  const ensureHttps = (url: string): string => {
    if (!url) return url;
    return url.startsWith("http://") ? url.replace("http://", "https://") : url;
  };

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
                        onWmsClick(
                          ensureHttps(message.wmsUrl as string),
                          message.title
                        );
                      }
                    }}
                    disabled={!message.wmsUrl || message.wmsUrl === "None"}
                  >
                    <Eye className="h-4 w-4 mr-2" />
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
              onClick={() => onDownloadClick(ensureHttps(message.downloadUrl!))}
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

  // Format bold text
  content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Format URLs, specifically handling geonorge catalog links
  content = content.replace(
    /\[([^\]]+)\]\((https?:\/\/kartkatalog\.geonorge\.no\/metadata\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-black hover:underline">$1</a>'
  );

  // Format other URLs
  content = content.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-black hover:underline">$1</a>'
  );

  // Format plain URLs that aren't already wrapped in markdown format
  content = content.replace(
    /(^|\s)(https?:\/\/[^\s]+)(?!\])/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-black hover:underline">$2</a>'
  );

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
