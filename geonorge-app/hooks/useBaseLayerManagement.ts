import { useState } from 'react';

export const useBaseLayerManagement = () => {
  const [currentBaseLayer, setCurrentBaseLayer] = useState<string>("topo");

  function setBaseLayer(layerType: string) {
    setCurrentBaseLayer(layerType);
  }

  function revertToBaseMap() {
    setBaseLayer("topo");
  }

  function changeToGraattKart() {
    setBaseLayer("graatone");
  }

  function changeToRasterKart() {
    setBaseLayer("raster");
  }

  function changeToSjoKart() {
    setBaseLayer("sjo");
  }

  return {
    currentBaseLayer,
    setBaseLayer,
    revertToBaseMap,
    changeToGraattKart,
    changeToRasterKart,
    changeToSjoKart
  };
};
