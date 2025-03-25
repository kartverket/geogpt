import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isStreaming: boolean;
}

export const ChatInput = ({
  value,
  onChange,
  onSubmit,
  isStreaming,
}: ChatInputProps) => {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center border-t border-gray-300 p-2 pb-3"
    >
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="Spør GeoGPT..."
        className="flex-1 rounded px-2 py-2 pb-5 text-sm focus:outline-none"
      />
      <Button
        type="submit"
        disabled={isStreaming || !value.trim()}
        className="w-10"
      >
        <Send />
      </Button>
    </form>
  );
};
