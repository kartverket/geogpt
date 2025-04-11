import React from "react";

interface VersionDisplayProps {
  className?: string;
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  className = "",
}) => {
  const appName = "GeoGPT ";
  const version = "v1.4.0-beta";

  return (
    <div
      className={`text-xs fixed bottom-0 right-3 text-color-gn-secondarylight ${className}`}
    >
      {appName}
      {version}
    </div>
  );
};
