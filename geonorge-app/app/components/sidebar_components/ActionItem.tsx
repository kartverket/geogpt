import * as React from "react";

interface ActionItemProps {
    icon: React.ElementType;
    title: string;
    url: string;
}

export const ActionItem: React.FC<ActionItemProps> = ({ icon: Icon, title, url }) => (
    <a
        href={url}
        className="flex items-center gap-3 p-2.5 rounded-md hover:bg-gray-50 transition-colors"
    >
        <div className="bg-color-gn-primary/10 rounded-md p-1.5 flex items-center justify-center">
            <Icon className="h-4 w-4 text-color-gn-primary" />
        </div>
        <span className="text-sm font-medium text-gray-700 truncate">
      {title}
    </span>
    </a>
);
