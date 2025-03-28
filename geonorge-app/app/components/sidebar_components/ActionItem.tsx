import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionItemProps {
  icon: React.ElementType;
  title: string;
  url?: string;
  disabled?: boolean;
  disabledMessage?: string;
  onClick?: () => void;
}

export const ActionItem: React.FC<ActionItemProps> = ({
  icon: Icon,
  title,
  url,
  disabled = false,
  disabledMessage,
  onClick,
}) => {
  const content = (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-omar transition-colors ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-gray-100 cursor-pointer"
      }`}
    >
      <div className="bg-color-gn-primary/10 rounded-md p-1.5 flex items-center justify-center">
        <Icon className="h-4 w-4 text-color-gn-primary" />
      </div>
      <span className="text-sm font-medium text-gray-700 truncate">
        {title}
      </span>
    </div>
  );

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.();
  };

  if (disabled && disabledMessage) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div onClick={handleClick}>{content}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-white border text-color-gn-secondary shadow-lg">
            <p>{disabledMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (url) {
    return (
      <a href={disabled ? undefined : url} onClick={handleClick}>
        {content}
      </a>
    );
  }

  return <div onClick={handleClick}>{content}</div>;
};
