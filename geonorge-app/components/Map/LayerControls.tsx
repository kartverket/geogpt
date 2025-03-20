import React from "react";
import { WMSLayer } from "@/types/map";
import { TrackedDataset } from "@/types/datasets";

interface LayerControlsProps {
  availableLayers: WMSLayer[];
  trackedDatasets: TrackedDataset[];
  onLayerChangeWithDataset: (datasetId: string, layerName: string, isChecked: boolean) => void;
}

export function LayerControls({
  availableLayers,
  trackedDatasets,
  onLayerChangeWithDataset,
}: LayerControlsProps) {
  return (
    <div className="space-y-4">
      {trackedDatasets.map((dataset) => (
        <div key={dataset.id} className="border p-2 rounded">
          <h3 className="font-medium">{dataset.title}</h3>
          <ul className="mt-1">
            {dataset.availableLayers.map((layer) => (
              <li key={layer.name} className="flex items-center">
                <input
                  type="checkbox"
                  id={`${dataset.id}-${layer.name}`}
                  checked={dataset.selectedLayers.includes(layer.name)}
                  onChange={(e) =>
                    onLayerChangeWithDataset(
                      dataset.id,
                      layer.name,
                      e.target.checked
                    )
                  }
                  className="mr-2"
                />
                <label htmlFor={`${dataset.id}-${layer.name}`} className="text-sm">
                  {layer.title || layer.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
