import { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Maximize, X } from "lucide-react";
import { ChatMessage as ChatMessageType } from "./types";
import GeoNorgeIcon from "../GeoNorgeIcon";

interface ChatWindowProps {
	messages: ChatMessageType[];
	input: string;
	onInputChange: (value: string) => void;
	onSubmit: (e: any) => void;
	isStreaming: boolean;
	onWmsClick: (url: string) => void;
	onDownloadClick: (url: string) => void;
	onEnterFullScreen: () => void;
	onClose: () => void;
}

// Keep as named export, don't change to default export
export const ChatWindow = ({
	messages,
	input,
	onInputChange,
	onSubmit,
	isStreaming,
	onWmsClick,
	onDownloadClick,
	onEnterFullScreen,
	onClose,
}: ChatWindowProps) => {
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
			<div className="px-4 py-2 flex justify-between items-center border-b">
				<div className="flex items-center">
					<GeoNorgeIcon />
					<span className="font-semibold text-lg ml-2">GeoGPT</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onEnterFullScreen}
						className="hover:bg-gray-100 transition-colors duration-200"
					>
						<Maximize className="h-4 w-4" />
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="hover:bg-gray-100 transition-colors duration-200"
						onClick={onClose}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div id="chatMessages" className="flex-1 p-4 overflow-y-auto space-y-2">
				<div className="text-sm text-gray-500">
					Hei! Jeg er GeoGPT. Spør meg om geodata!
				</div>
				{messages.map((msg, idx) => (
					<ChatMessage
						key={idx}
						message={msg}
						onWmsClick={onWmsClick}
						onDownloadClick={onDownloadClick}
					/>
				))}
				<div ref={chatEndRef} />
			</div>

			<ChatInput
				value={input}
				onChange={onInputChange}
				onSubmit={onSubmit}
				isStreaming={isStreaming}
			/>
		</div>
	);
};