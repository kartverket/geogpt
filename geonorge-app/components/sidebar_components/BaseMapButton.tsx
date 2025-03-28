import * as React from "react";
import Image from "next/image";
import { Check } from "lucide-react";

interface BaseMapButtonProps {
  selected: boolean;
  onClick: () => void;
  imageSrc: string;
  altText: string;
  label: string;
}

export const BaseMapButton: React.FC<BaseMapButtonProps> = ({
  selected,
  onClick,
  imageSrc,
  altText,
  label,
}) => {
  return (
    <div
      className={`flex flex-col w-30 items-center p-2 rounded-md border transition-colors cursor-pointer relative ${
        selected
          ? "border-color-gn-primary bg-color-gn-primary/5 ring-1 ring-color-gn-primary/30"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onClick}
    >
      <div className="w-full h-20 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
        <Image
          src={imageSrc}
          alt={altText}
          className="w-full h-full object-cover"
          width={100}
          height={64}
          unoptimized
        />
      </div>
      <span className="text-xs font-medium text-center">{label}</span>

      {selected && (
        <div className="absolute top-1 right-1 bg-color-gn-primary rounded-full p-0.5">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
};
