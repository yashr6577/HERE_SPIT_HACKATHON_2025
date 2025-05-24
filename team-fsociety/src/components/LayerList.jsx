import React from 'react';

const LayerList = ({ layers, setLayers, selectedLayers, onToggleSelection, onLog }) => {
  const toggleLayerVisibility = (layerId) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
    const layer = layers.find(l => l.id === layerId);
    onLog(`Toggled visibility: ${layer?.name} ${layer?.visible ? 'hidden' : 'visible'}`);
  };

  const removeLayer = (layerId) => {
    const layer = layers.find(l => l.id === layerId);
    if (confirm(`Remove layer "${layer?.name}"?`)) {
      setLayers(prev => prev.filter(layer => layer.id !== layerId));
      onLog(`Removed layer: ${layer?.name}`);
    }
  };

  // FIXED: Helper function to get feature count from either structure
  const getFeatureCount = (layer) => {
    // Check both possible locations for feature count
    const fromProperties = layer.properties?.featureCount;
    const fromMetadata = layer.metadata?.featureCount;
    const fromDataFeatures = layer.data?.features?.length;
    const fromFeatures = layer.features?.length;
    
    return fromProperties || fromMetadata || fromDataFeatures || fromFeatures || 0;
  };

  // FIXED: Helper function to get layer type
  const getLayerType = (layer) => {
    // For drawn layers, use the type property
    if (layer.source === 'drawn' && layer.type) {
      return layer.type;
    }
    
    // For uploaded layers, try to determine from geometry
    if (layer.metadata?.geometryTypes?.length > 0) {
      return layer.metadata.geometryTypes[0];
    }
    
    // Fallback to generic type
    return layer.type || 'Unknown';
  };

  if (layers.length === 0) {
    return (
      <div className="no-layers">
        <p>No layers loaded</p>
        <small>Upload a file or create a new layer to get started</small>
      </div>
    );
  }

  return (
    <div className="layer-list">
      {/* ADD DEBUG INFO */}
      <div className="debug-layer-info" style={{fontSize: '10px', color: '#999', marginBottom: '5px'}}>
        Total: {layers.length} | Drawn: {layers.filter(l => l.source === 'drawn').length} | 
        Uploaded: {layers.filter(l => l.source !== 'drawn').length}
      </div>
      
      <ul className="layers">
        {layers.map(layer => {
          const featureCount = getFeatureCount(layer);
          const layerType = getLayerType(layer);
          
          return (
            <li key={layer.id} className="layer-item">
              <div className={`layer-controls ${layer.selectedForOperation ? 'selected-for-operation' : ''}`}>
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  className="layer-selection-checkbox"
                  checked={selectedLayers.has(layer.id)}
                  onChange={() => onToggleSelection(layer.id)}
                  title="Select for operations"
                />
                
                {/* Visibility checkbox */}
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => toggleLayerVisibility(layer.id)}
                  title="Toggle visibility"
                />
                
                {/* Layer color indicator */}
                <div 
                  className="layer-color" 
                  style={{ backgroundColor: layer.color }}
                  title={`Layer color: ${layer.color}`}
                ></div>
                
                {/* Layer info */}
                <div className="layer-info">
                  <span className="layer-name" title={`Layer: ${layer.name}`}>
                    {layer.name}
                    {/* ADD SOURCE INDICATOR */}
                    {layer.source === 'drawn' && <small style={{color: '#28a745'}}> ✏️</small>}
                  </span>
                  <div className="layer-details">
                    <small className="layer-type">{layerType.toUpperCase()}</small>
                    {/* FIXED: Use the helper function */}
                    {featureCount > 0 && (
                      <small className="feature-count">
                        • {featureCount} feature{featureCount !== 1 ? 's' : ''}
                      </small>
                    )}
                    {layer.selectedForOperation && (
                      <small className="operation-indicator">• Selected for operation</small>
                    )}
                    {/* ADD ADDITIONAL DEBUG INFO */}
                    <small style={{color: '#999', fontSize: '9px'}}>
                      {layer.source === 'drawn' ? `[Drawn ${new Date(layer.metadata?.created).toLocaleTimeString()}]` : '[Uploaded]'}
                    </small>
                  </div>
                </div>
                
                {/* Remove button */}
                <button
                  className="remove-button"
                  onClick={() => removeLayer(layer.id)}
                  title={`Remove layer: ${layer.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LayerList;