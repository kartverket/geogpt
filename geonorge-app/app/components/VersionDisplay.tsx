import React from "react";

interface VersionDisplayProps {
  className?: string;
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  className = "",
}) => {
  const version = "GeoNorge v1.0.0";

  return (
    <div
      className={`text-xs fixed bottom-0 right-3 text-color-gn-secondarylight ${className}`}
    >
      {version}
    </div>
  );
};
