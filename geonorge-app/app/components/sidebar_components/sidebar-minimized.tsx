import React from "react";
import {
  Search,
  Map,
  Mail,
  Shield,
  Wrench,
  HelpCircle,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import GeoNorgeIcon from "@/components/ui/GeoNorgeIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarMinimizedProps {
  className?: string;
  children?: React.ReactNode;
}

const SidebarMinimizedButton = ({
  icon: Icon,
  isActive = false,
  onClick,
  tooltip,
}: {
  icon: React.ElementType;
  isActive?: boolean;
  onClick?: () => void;
  tooltip: string;
}) => {
  const { toggleSidebar } = useSidebar();

  const handleClick = () => {
    if (onClick) onClick();
    toggleSidebar();
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "w-full h-auto flex flex-col items-center justify-center text-xxs text-gray-500 hover:text-orange-500 transition-colors duration-200 px-2",
              isActive && "text-orange-500 bg-orange-50"
            )}
          >
            <Icon size={24} />
            <span className="text-xxs 2xl:text-xs mt-1">{tooltip}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="bg-white border text-color-gn-secondary shadow-lg"
          side="right"
        >
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const SidebarMinimized: React.FC<SidebarMinimizedProps> = ({
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        "fixed left-0 top-0 bottom-0 flex flex-col bg-white shadow-lg rounded-omar z-0 h-full w-24 2xl:w-28 overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col h-full py-6 justify-between">
        {/* Sidebar items */}
        <div className="flex flex-col items-center space-y-8 ">
          <SidebarTrigger />
          <GeoNorgeIcon />
          <SidebarMinimizedButton icon={Search} tooltip="Adressesøk" />
          <SidebarMinimizedButton icon={Map} tooltip="Bakgrunnskart" />
          <SidebarMinimizedButton icon={Wrench} tooltip="Verktøy" />
          <SidebarMinimizedButton icon={HelpCircle} tooltip="Tips og triks" />
          <SidebarMinimizedButton icon={Mail} tooltip="Kontakt oss" />
          <SidebarMinimizedButton icon={Shield} tooltip="Personvern" />
          <SidebarMinimizedButton icon={Languages} tooltip="Språk" />
        </div>
      </div>
      {children}
    </div>
  );
};
