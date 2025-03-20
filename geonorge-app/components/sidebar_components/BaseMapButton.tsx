import * as React from "react";
import Image from "next/image";

interface BaseMapButtonProps {
    selected: boolean; // Sier om knappen er valgt eller ikke
    onClick: () => void; // Hva som skjer når du klikker på knappen
    imageSrc: string; // URL til kartbildet
    altText: string; // Alternativ tekst for bildet
    label: string; // Tekst under bildet
}

export const BaseMapButton: React.FC<BaseMapButtonProps> = ({ selected, onClick, imageSrc, altText, label }) => {
    return (
        <button
            className={`flex flex-col items-center p-2 rounded-md border transition-colors ${
                selected
                    ? "border-color-gn-primary bg-color-gn-primary/5 ring-1 ring-color-gn-primary/30"
                    : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={onClick}
        >
            <div className="w-full h-16 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                <Image src={imageSrc} alt={altText} className="w-full h-full object-cover" width={100} height={64} unoptimized />
            </div>
            <span className="text-xs font-medium text-center">{label}</span>
        </button>
    );
};