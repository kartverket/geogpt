import {
  ChatMessage,
  type ChatMessageProps,
  type Message as BaseMessage,
} from "@/components/ui/chat-message";

interface Message extends BaseMessage {
  uuid?: string;
  title?: string;
  wmsUrl?: any;
  downloadUrl?: string;
  downloadFormats?: string[];
  imageUrl?: string;
}
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import Image from "next/image";

interface DownloadInfo {
  uuid: string;
  title: string;
  downloadUrl: string;
  downloadFormats: any[];
}

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>;

interface MessageListProps {
  messages: Message[];
  showTimeStamps?: boolean;
  isTyping?: boolean;
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: Message) => AdditionalMessageOptions);
  onWmsClick?: (searchResult: any) => void;
  onDownloadClick?: (info: DownloadInfo) => void; // Updated type
  onExitFullScreen?: () => void;
}

export function MessageList({
  messages,
  showTimeStamps = true,
  isTyping = false,
  messageOptions,
  onWmsClick,
  onDownloadClick,
  onExitFullScreen,
}: MessageListProps) {
  const isValidWmsUrl = (wmsInfo: any): boolean => {
    return (
      wmsInfo &&
      wmsInfo !== "None" &&
      typeof wmsInfo === "object" &&
      "wms_url" in wmsInfo &&
      wmsInfo.wms_url &&
      wmsInfo.wms_url !== "None"
    );
  };

  return (
    <div className="space-y-4 overflow-visible">
      {messages.map((message, index) => {
        const additionalOptions =
          typeof messageOptions === "function"
            ? messageOptions(message)
            : messageOptions;

        if (message.type === "image" && message.imageUrl) {
          return (
            <div key={index} className="flex flex-col items-start space-y-2">
              <Image
                src={message.imageUrl}
                alt="Dataset visualization"
                className="max-w-[300px] h-auto rounded"
                width={1080}
                height={1080}
              />
              <div className="flex gap-2 z-10">
                <Button
                  onClick={() => {
                    if (isValidWmsUrl(message.wmsUrl)) {
                      const searchResult = {
                        uuid: message.id || `msg-${Date.now()}`,
                        title: message.wmsUrl.title,
                        wmsUrl: message.wmsUrl,
                        downloadUrl: message.downloadUrl || null,
                        downloadFormats: message.downloadFormats || [],
                      };
                      onWmsClick?.(searchResult);
                      onExitFullScreen?.();
                    }
                  }}
                  variant="show"
                  className={`transition-colors relative ${
                    isValidWmsUrl(message.wmsUrl) ? "" : " cursor-not-allowed"
                  }`}
                  disabled={!isValidWmsUrl(message.wmsUrl)}
                >
                  <Eye className="h-4 w-4" />
                  Vis på kart
                </Button>
                {message.downloadUrl && (
                  <Button
                    onClick={() => {
                      const downloadInfo: DownloadInfo = {
                        uuid: message.uuid || `download-${Date.now()}`,
                        title:
                          message.title ||
                          message.wmsUrl?.title ||
                          "Ukjent datasett",
                        downloadUrl: message.downloadUrl!,
                        downloadFormats: message.downloadFormats || [],
                      };
                      onDownloadClick?.(downloadInfo);
                    }}
                    variant="download"
                  >
                    <Download className="h-4 w-4" />
                    Last ned datasett
                  </Button>
                )}
              </div>
            </div>
          );
        }

        return (
          <ChatMessage
            key={index}
            showTimeStamp={showTimeStamps}
            {...message}
            {...additionalOptions}
          />
        );
      })}
      {isTyping && <TypingIndicator />}
    </div>
  );
}
