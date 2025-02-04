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
                {message.wmsUrl && (
                  <Button
                    onClick={() => {
                      onWmsClick?.(message.wmsUrl!);
                      onExitFullScreen?.();
                    }}
                    variant="secondary"
                    className="hover:bg-green-600 bg-green-500 text-white hover:text-white transition-colors relative"
                  >
                    Vis
                  </Button>
                )}
                {message.downloadUrl && (
                  <Button
                    onClick={() => onDownloadClick?.(message.downloadUrl!)}
                    variant="secondary"
                    className="hover:bg-green-600 bg-green-500 text-white hover:text-white transition-colors relative"
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
