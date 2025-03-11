import {
  ChatMessage,
  type ChatMessageProps,
  type Message,
} from "@/components/ui/chat-message";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Button } from "@/components/ui/button";

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>;

interface MessageListProps {
  messages: Message[];
  showTimeStamps?: boolean;
  isTyping?: boolean;
  messageOptions?:
    | AdditionalMessageOptions
    | ((message: Message) => AdditionalMessageOptions);
  onWmsClick?: (url: string) => void;
  onDownloadClick?: (url: string) => void;
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
  const isValidWmsUrl = (url: string | undefined | null): boolean => {
    return url !== undefined && url !== null && url !== "None";
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
              <img
                src={message.imageUrl}
                alt="Dataset visualization"
                className="max-w-[300px] h-auto rounded"
              />
              <div className="flex gap-2 z-10">
                <Button
                  onClick={() => {
                    if (isValidWmsUrl(message.wmsUrl)) {
                      onWmsClick?.(message.wmsUrl!);
                      onExitFullScreen?.();
                    }
                  }}
                  variant="secondary"
                  className={`transition-colors relative ${
                    isValidWmsUrl(message.wmsUrl)
                      ? " rounded-[2px] bg-[#FF8B65] hover:bg-[#FE642F] text-white"
                      : "rounded-[2px] bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={!isValidWmsUrl(message.wmsUrl)}
                >
                  Vis
                </Button>
                {message.downloadUrl && (
                  <Button
                    onClick={() => onDownloadClick?.(message.downloadUrl!)}
                    variant="secondary"
                    className="rounded-[2px] bg-[#404041] hover:bg-[#5c5c5d] text-white"
                  >
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
