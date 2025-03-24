import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
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
			className="flex items-center border-t border-gray-300 p-2"
		>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Spør GeoGPT..."
				className="flex-1 rounded px-2 py-2 pb-5 text-sm focus:outline-none"
			/>
			<Button
				type="submit"
				className="ml-2 text-sm"
				disabled={isStreaming || !value.trim()}
			>
				<Send />
			</Button>
		</form>
	);
};
