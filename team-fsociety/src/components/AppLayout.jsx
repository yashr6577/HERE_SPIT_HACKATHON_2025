import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';
import Toolbar from './Toolbar.jsx';
import MapCanvas from './MapCanvas.jsx';
import LogPanel from './LogPanel.jsx';
import { generateRandomColor } from '../utils/colorUtils.js';
import { parseGeoJSON } from '../gis/parsers/geojsonParser.js';
import { parseShapefile, parseShapefileFromZip } from '../gis/parsers/shapefileParser.js';
import { parseWKT } from '../gis/parsers/wktParser.js';
import { executeGISOperation } from '../gis/operations/gisOperations.js';

const AppLayout = () => {
  const [selectedTool, setSelectedTool] = useState(null);
  const [layers, setLayers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [highlightResults, setHighlightResults] = useState(null);

  const addLog = (message) => {
    setLogs(prev => [...prev, { 
      id: Date.now(), 
      message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  // Add this debug useEffect to see when layers change
  useEffect(() => {
    console.log('🔍 AppLayout layers state changed:', layers);
    console.log('📊 Total layers:', layers.length);
    console.log('📊 Drawn layers:', layers.filter(l => l.source === 'drawn'));
  }, [layers]);

  // Update the handleGISOperation function with better logging:

const handleGISOperation = (operation) => {
  const selectedLayers = layers.filter(layer => layer.selectedForOperation);
  
  if (selectedLayers.length === 0) {
    addLog(`${operation} operation failed: No layers selected`);
    return;
  }

  addLog(`Executing ${operation} operation on ${selectedLayers.length} layer(s)...`);
  
  // Log selected layer details
  selectedLayers.forEach((layer, index) => {
    addLog(`Layer ${index + 1}: ${layer.name} (${layer.properties.featureCount} features)`);
  });

  // Show operation options dialog for buffer
  let options = {};
  if (operation === 'buffer') {
    const distance = prompt('Enter buffer distance in meters:', '1000');
    if (distance === null) return; // User cancelled
    options.distance = parseFloat(distance) || 1000;
  }

  const result = executeGISOperation(operation, selectedLayers, options);
  
  // Enhanced logging for debugging
  addLog(`Operation result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  
  if (result.success) {
    addLog(`Result features: ${result.resultLayer.data.features.length}`);
    addLog(`Result bounds: ${JSON.stringify(result.resultLayer.metadata.bounds || 'No bounds')}`);
    
    // Log first feature geometry type if exists
    if (result.resultLayer.data.features.length > 0) {
      const firstFeature = result.resultLayer.data.features[0];
      addLog(`First result geometry: ${firstFeature.geometry.type}`);
      addLog(`First result coordinates length: ${firstFeature.geometry.coordinates?.length || 0}`);
    }
    
    // Add result layer to map
    setLayers(prev => [...prev, result.resultLayer]);
    
    // Highlight results temporarily (longer time for debugging)
    setHighlightResults(result.resultLayer.data);
    setTimeout(() => setHighlightResults(null), 10000); // 10 seconds instead of 3
    
    addLog(result.message);
    addLog(`Result layer added: ${result.resultLayer.name}`);
    
    // Don't reset tool selection immediately for debugging
    // setSelectedTool(null);
  } else {
    addLog(`${operation} operation failed: ${result.error}`);
    console.error('GIS Operation Error:', result);
  }
};

  // Updated tool selection handler
  const handleToolSelect = (toolId) => {
    setSelectedTool(toolId);
    
    // Execute operation immediately for GIS tools
    if (['union', 'intersection', 'difference', 'buffer', 'spatial-join'].includes(toolId)) {
      handleGISOperation(toolId);
    }
  };

  const handleFileUpload = async (file) => {
    addLog(`Processing file: ${file.name}`);
    
    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let parseResult = null;

      // Parse file based on extension
      switch (fileExtension) {
        case 'geojson':
        case 'json':
          parseResult = await parseGeoJSON(file);
          break;
        case 'shp':
          parseResult = await parseShapefile(file);
          break;
        case 'zip':
          parseResult = await parseShapefileFromZip(file);
          break;
        case 'wkt':
          const wktText = await file.text();
          parseResult = parseWKT(wktText);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      if (!parseResult.success) {
        throw new Error(parseResult.error);
      }

      // Create new layer from parsed data
      const newLayer = {
        id: Date.now(),
        name: file.name.split('.')[0],
        visible: true,
        color: generateRandomColor(),
        type: parseResult.format,
        selected: false,
        selectedForOperation: false,
        data: parseResult.data,
        metadata: parseResult.metadata,
        properties: {
          featureCount: parseResult.metadata.featureCount,
          uploadDate: new Date().toLocaleDateString(),
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          bounds: parseResult.metadata.bounds,
          geometryTypes: parseResult.metadata.geometryTypes
        }
      };

      setLayers(prev => [...prev, newLayer]);
      addLog(`Added layer: ${newLayer.name} (${newLayer.type.toUpperCase()}) - ${newLayer.properties.featureCount} features`);

      if (parseResult.metadata.errors && parseResult.metadata.errors.length > 0) {
        addLog(`Warning: ${parseResult.metadata.errors.length} features had errors during parsing`);
      }

    } catch (error) {
      addLog(`Error processing file: ${error.message}`);
    }
  };

  const handleExport = (layersToExport) => {
    addLog(`Exporting ${layersToExport.length} layer(s)...`);
    
    try {
      // Combine all features from exported layers
      const allFeatures = [];
      
      layersToExport.forEach(layer => {
        if (layer.data && layer.data.features) {
          layer.data.features.forEach(feature => {
            allFeatures.push({
              ...feature,
              properties: {
                ...feature.properties,
                sourceLayer: layer.name,
                layerColor: layer.color
              }
            });
          });
        }
      });

      const exportData = {
        type: "FeatureCollection",
        features: allFeatures,
        metadata: {
          exportDate: new Date().toISOString(),
          layerCount: layersToExport.length,
          layerNames: layersToExport.map(l => l.name),
          totalFeatures: allFeatures.length,
          tool: "GIS Tool",
          version: "1.0.0"
        }
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gis-export-${new Date().getTime()}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog(`Successfully exported ${allFeatures.length} features to GeoJSON`);
    } catch (error) {
      addLog(`Export failed: ${error.message}`);
    }
  };

  return (
    <div className="app-layout">
      <Toolbar 
        selectedTool={selectedTool} 
        onToolSelect={handleToolSelect}
        onLog={addLog}
        layers={layers}
        onFileUpload={handleFileUpload}
        onExport={handleExport}
      />
      <div className="main-content">
        <Sidebar 
          layers={layers} 
          setLayers={setLayers}
          onLog={addLog}
        />
        <MapCanvas 
          selectedTool={selectedTool}
          layers={layers}
          setLayers={setLayers}
          onLog={addLog}
          highlightResults={highlightResults}
        />
      </div>
      <LogPanel logs={logs} />
    </div>
  );
};

export default AppLayout;