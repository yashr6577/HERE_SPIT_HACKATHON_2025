import React, { useState, useEffect } from 'react';
import LayerList from './LayerList.jsx';
import { generateRandomColor } from '../utils/colorUtils.js';

const Sidebar = ({ layers, setLayers, onLog }) => {
  const [selectedLayers, setSelectedLayers] = useState(new Set());

  // ADD THIS DEBUG EFFECT
  useEffect(() => {
    console.log('🔍 Sidebar received layers:', layers);
    console.log('📊 Total layers in sidebar:', layers.length);
    console.log('📊 Drawn layers in sidebar:', layers.filter(l => l.source === 'drawn'));
    
    // Check layer structure
    layers.forEach(layer => {
      console.log(`📋 Layer "${layer.name}":`, {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        source: layer.source,
        featureCount: layer.data?.features?.length || layer.features?.length || 0,
        structure: Object.keys(layer)
      });
    });
  }, [layers]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onLog(`Loading file: ${file.name}`);
      
      // Create a new layer from uploaded file
      const newLayer = {
        id: Date.now(),
        name: file.name.split('.')[0],
        visible: true,
        color: generateRandomColor(),
        type: file.name.split('.').pop().toLowerCase(),
        selected: false,
        features: [], // Will contain actual geometry data
        properties: {
          featureCount: 0,
          uploadDate: new Date().toLocaleDateString()
        }
      };
      
      setLayers(prev => [...prev, newLayer]);
      onLog(`Added layer: ${newLayer.name} (${newLayer.type.toUpperCase()})`);
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleAddLayer = () => {
    const layerName = prompt('Enter layer name:');
    if (layerName && layerName.trim()) {
      const newLayer = {
        id: Date.now(),
        name: layerName.trim(),
        visible: true,
        color: generateRandomColor(),
        type: 'manual',
        selected: false,
        features: [],
        properties: {
          featureCount: 0,
          createdDate: new Date().toLocaleDateString()
        }
      };
      
      setLayers(prev => [...prev, newLayer]);
      onLog(`Created new layer: ${newLayer.name}`);
    }
  };

  const handleRemoveSelectedLayers = () => {
    if (selectedLayers.size === 0) {
      onLog('No layers selected for removal');
      return;
    }

    const layersToRemove = layers.filter(layer => selectedLayers.has(layer.id));
    const layerNames = layersToRemove.map(layer => layer.name).join(', ');
    
    if (confirm(`Remove ${selectedLayers.size} layer(s): ${layerNames}?`)) {
      setLayers(prev => prev.filter(layer => !selectedLayers.has(layer.id)));
      setSelectedLayers(new Set());
      onLog(`Removed layers: ${layerNames}`);
    }
  };

  const handleSelectForOperation = () => {
    if (selectedLayers.size === 0) {
      onLog('No layers selected for operation');
      return;
    }

    const selectedLayersList = layers.filter(layer => selectedLayers.has(layer.id));
    const layerNames = selectedLayersList.map(layer => layer.name).join(', ');
    
    // Mark layers as selected for operation
    setLayers(prev => 
      prev.map(layer => ({
        ...layer,
        selectedForOperation: selectedLayers.has(layer.id)
      }))
    );
    
    onLog(`Selected for operation: ${layerNames} (${selectedLayers.size} layers)`);
  };

  const toggleLayerSelection = (layerId) => {
    setSelectedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  const selectAllLayers = () => {
    if (selectedLayers.size === layers.length) {
      setSelectedLayers(new Set());
      onLog('Deselected all layers');
    } else {
      setSelectedLayers(new Set(layers.map(layer => layer.id)));
      onLog(`Selected all ${layers.length} layers`);
    }
  };

  return (
    <div className="sidebar">
      {/* Data Import Section */}
      <div className="sidebar-section">
        <h3>📁 Data Import</h3>
        <input
          type="file"
          accept=".geojson,.json,.kml,.gpx,.shp"
          onChange={handleFileUpload}
          className="file-input"
          title="Upload GIS files (GeoJSON, KML, GPX, Shapefile)"
        />
        <div className="file-types">
          <small>Supported: GeoJSON, KML, GPX, Shapefile</small>
        </div>
      </div>

      {/* Layer Management Buttons */}
      <div className="sidebar-section">
        <h3>🛠️ Layer Management</h3>
        <div className="button-group">
          <button 
            className="sidebar-button primary"
            onClick={handleAddLayer}
            title="Create a new empty layer"
          >
            ➕ Add Layer
          </button>
          
          <button 
            className="sidebar-button danger"
            onClick={handleRemoveSelectedLayers}
            disabled={selectedLayers.size === 0}
            title={`Remove ${selectedLayers.size} selected layer(s)`}
          >
            🗑️ Remove Selected
          </button>
          
          <button 
            className="sidebar-button success"
            onClick={handleSelectForOperation}
            disabled={selectedLayers.size === 0}
            title={`Use ${selectedLayers.size} selected layer(s) for GIS operations`}
          >
            🎯 Select for Operation
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="sidebar-section">
        <div className="layer-list-header">
          <h3>📋 Layers ({layers.length})</h3>
          {/* ADD DEBUG INFO */}
          <div className="debug-info" style={{fontSize: '12px', color: '#666'}}>
            Drawn: {layers.filter(l => l.source === 'drawn').length} | 
            Uploaded: {layers.filter(l => l.source !== 'drawn').length}
          </div>
          {layers.length > 0 && (
            <button 
              className="select-all-button"
              onClick={selectAllLayers}
              title={selectedLayers.size === layers.length ? 'Deselect all' : 'Select all'}
            >
              {selectedLayers.size === layers.length ? '☑️' : '☐'} All
            </button>
          )}
        </div>
        
        <LayerList 
          layers={layers} 
          setLayers={setLayers}
          selectedLayers={selectedLayers}
          onToggleSelection={toggleLayerSelection}
          onLog={onLog}
        />
      </div>

      {/* Selection Info */}
      {selectedLayers.size > 0 && (
        <div className="sidebar-section">
          <div className="selection-info">
            <strong>{selectedLayers.size}</strong> layer(s) selected
            <div className="selected-layers-list">
              {layers
                .filter(layer => selectedLayers.has(layer.id))
                .map(layer => (
                  <div key={layer.id} className="selected-layer-item">
                    <div 
                      className="layer-color-small" 
                      style={{ backgroundColor: layer.color }}
                    ></div>
                    <span>{layer.name}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;