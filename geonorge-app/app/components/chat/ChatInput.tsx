import { FormEvent } from 'react';
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isStreaming: boolean;
}

export const ChatInput = ({ value, onChange, onSubmit, isStreaming }: ChatInputProps) => {
  return (
    <form onSubmit={onSubmit} className="flex items-center border-t border-gray-300 p-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Spør GeoGPT..."
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <Button
        type="submit"
        className="ml-2 text-sm"
        disabled={isStreaming || !value.trim()}
      >
        Send
      </Button>
    </form>
  );
};