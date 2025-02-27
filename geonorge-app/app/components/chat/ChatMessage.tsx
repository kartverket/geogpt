import { Button } from "@/components/ui/button";
import { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
  onWmsClick: (url: string) => void;
  onDownloadClick: (url: string) => void;
}

export const ChatMessage = ({ message, onWmsClick, onDownloadClick }: ChatMessageProps) => {
  if (message.type === "image" && message.imageUrl) {
    return (
      <div className="flex flex-col space-y-2 my-2">
        <img
          src={message.imageUrl}
          alt="Dataset"
          className="max-w-full h-auto rounded"
        />
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (message.wmsUrl && message.wmsUrl !== "None") {
                onWmsClick(message.wmsUrl);
              }
            }}
            className={`text-xs ${
              message.wmsUrl && message.wmsUrl !== "None"
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            disabled={!message.wmsUrl || message.wmsUrl === "None"}
          >
            Vis
          </Button>
          {message.downloadUrl && (
            <Button
              onClick={() => onDownloadClick(message.downloadUrl!)}
              className="bg-green-500 text-white text-xs"
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
        className={`max-w-[80%] p-2 rounded shadow text-sm whitespace-pre-wrap ${
          isUser ? "bg-blue-100" : "bg-gray-100"
        }`}
      >
        {isUser ? <strong>You:</strong> : <strong>System:</strong>}
        <span
          className="ml-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
};