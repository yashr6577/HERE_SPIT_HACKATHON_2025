import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Drawing Handler Component
const DrawingHandler = ({ selectedTool, onAddFeature, onLog }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLineCoordinates, setCurrentLineCoordinates] = useState([]);
  const [currentPolygonCoordinates, setCurrentPolygonCoordinates] = useState([]);
  const [currentDrawingLayer, setCurrentDrawingLayer] = useState(null);

  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      
      switch (selectedTool) {
        case 'draw-point':
          handleDrawPoint(lng, lat);
          break;
        case 'draw-line':
          handleDrawLine(lng, lat);
          break;
        case 'draw-polygon':
          handleDrawPolygon(lng, lat);
          break;
        default:
          break;
      }
    },
    keydown: (e) => {
      if (e.originalEvent.key === 'Escape') {
        cancelDrawing();
      } else if (e.originalEvent.key === 'Enter') {
        finishDrawing();
      }
    }
  });

  // Update cursor and instructions based on selected tool
  useEffect(() => {
    if (!map) return;
    
    const mapContainer = map.getContainer();
    
    switch (selectedTool) {
      case 'draw-point':
        mapContainer.style.cursor = 'crosshair';
        onLog('📍 Click on map to place POI');
        break;
      case 'draw-line':
        mapContainer.style.cursor = 'crosshair';
        onLog('📏 Click to start line, continue clicking to add points, press Enter to finish');
        break;
      case 'draw-polygon':
        mapContainer.style.cursor = 'crosshair';
        onLog('⬟ Click to start polygon, continue clicking to add points, press Enter to finish');
        break;
      case 'clear-canvas':
        mapContainer.style.cursor = 'default';
        break;
      default:
        mapContainer.style.cursor = 'grab';
        break;
    }

    // Clean up on tool change
    return () => {
      if (selectedTool !== 'draw-line' && selectedTool !== 'draw-polygon') {
        cancelDrawing();
      }
    };
  }, [selectedTool, map]);

  // Handle keyboard events - IMPROVED VERSION
  useEffect(() => {
    const handleKeyPress = (e) => {
      console.log('⌨️ Key pressed:', e.key, 'Current tool:', selectedTool);
      
      if (e.key === 'Escape') {
        console.log('🚫 Escape pressed - cancelling drawing');
        cancelDrawing();
      } else if (e.key === 'Enter') {
        console.log('✅ Enter pressed - finishing drawing');
        e.preventDefault(); // Prevent form submission
        finishDrawing();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyPress);
    
    // Also add instructions when starting line/polygon drawing
    if (selectedTool === 'draw-line' && currentLineCoordinates.length > 0) {
      onLog(`📏 Line in progress (${currentLineCoordinates.length} points). Press Enter to finish or Escape to cancel.`);
    } else if (selectedTool === 'draw-polygon' && currentPolygonCoordinates.length > 0) {
      onLog(`⬟ Polygon in progress (${currentPolygonCoordinates.length} points). Press Enter to finish or Escape to cancel.`);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentLineCoordinates, currentPolygonCoordinates, selectedTool]);

  const handleDrawPoint = (lng, lat) => {
    console.log('🎯 Drawing point at:', lng, lat);
    
    const pointFeature = {
      type: 'Feature',
      properties: {
        name: `POI ${new Date().toLocaleTimeString()}`,
        type: 'point',
        created: new Date().toISOString(),
        description: 'Point of Interest'
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    };

    console.log('📍 Point feature created:', pointFeature);
    
    onAddFeature(pointFeature);
    onLog(`✅ POI added at [${lng.toFixed(6)}, ${lat.toFixed(6)}]`);
  };

  const handleDrawLine = (lng, lat) => {
    const newCoords = [...currentLineCoordinates, [lng, lat]];
    setCurrentLineCoordinates(newCoords);
    console.log('📏 Line coords updated:', newCoords);

    if (newCoords.length === 1) {
      onLog(`📏 Line started at [${lng.toFixed(4)}, ${lat.toFixed(4)}]. Click to add more points, press Enter to finish.`);
      setIsDrawing(true);
    } else {
      onLog(`📏 Added point ${newCoords.length} at [${lng.toFixed(4)}, ${lat.toFixed(4)}]. Press Enter to finish line.`);
    }

    updateLinePreview(newCoords);
  };

  const handleDrawPolygon = (lng, lat) => {
    const newCoords = [...currentPolygonCoordinates, [lng, lat]];
    setCurrentPolygonCoordinates(newCoords);
    console.log('⬟ Polygon coords updated:', newCoords);

    if (newCoords.length === 1) {
      onLog(`⬟ Polygon started at [${lng.toFixed(4)}, ${lat.toFixed(4)}]. Click to add more points, press Enter to finish.`);
      setIsDrawing(true);
    } else {
      onLog(`⬟ Added point ${newCoords.length} at [${lng.toFixed(4)}, ${lat.toFixed(4)}]. Press Enter to finish polygon.`);
    }

    updatePolygonPreview(newCoords);
  };

  const finishDrawing = () => {
    console.log('🏁 Finishing drawing...');
    console.log('📏 Current line coords:', currentLineCoordinates);
    console.log('⬟ Current polygon coords:', currentPolygonCoordinates);
    
    if (selectedTool === 'draw-line' && currentLineCoordinates.length >= 2) {
      console.log('✅ Creating line feature...');
      
      const lineFeature = {
        type: 'Feature',
        properties: {
          name: `Line ${new Date().toLocaleTimeString()}`,
          type: 'line',
          created: new Date().toISOString(),
          length_km: calculateLineLength(currentLineCoordinates),
          description: 'User drawn line'
        },
        geometry: {
          type: 'LineString',
          coordinates: currentLineCoordinates
        }
      };
  
      console.log('📏 Line feature created:', lineFeature);
      
      // MAKE SURE this is called
      if (typeof onAddFeature === 'function') {
        onAddFeature(lineFeature);
        onLog(`✅ Line completed with ${currentLineCoordinates.length} points`);
      } else {
        console.error('❌ onAddFeature is not a function for line');
      }
      
      // Clean up
      setCurrentLineCoordinates([]);
      setIsDrawing(false);
      clearPreview();
      
    } else if (selectedTool === 'draw-polygon' && currentPolygonCoordinates.length >= 3) {
      console.log('✅ Creating polygon feature...');
      
      // Close the polygon
      const closedCoords = [...currentPolygonCoordinates, currentPolygonCoordinates[0]];
      
      const polygonFeature = {
        type: 'Feature',
        properties: {
          name: `Polygon ${new Date().toLocaleTimeString()}`,
          type: 'polygon',
          created: new Date().toISOString(),
          area_km2: calculatePolygonArea(closedCoords),
          description: 'User drawn polygon'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords]
        }
      };
  
      console.log('⬟ Polygon feature created:', polygonFeature);
      
      // MAKE SURE this is called
      if (typeof onAddFeature === 'function') {
        onAddFeature(polygonFeature);
        onLog(`✅ Polygon completed with ${currentPolygonCoordinates.length} points`);
      } else {
        console.error('❌ onAddFeature is not a function for polygon');
      }
      
      // Clean up
      setCurrentPolygonCoordinates([]);
      setIsDrawing(false);
      clearPreview();
      
    } else {
      // Not enough points
      if (selectedTool === 'draw-line') {
        onLog(`❌ Line needs at least 2 points (currently ${currentLineCoordinates.length})`);
      } else if (selectedTool === 'draw-polygon') {
        onLog(`❌ Polygon needs at least 3 points (currently ${currentPolygonCoordinates.length})`);
      }
    }
  };

  const cancelDrawing = () => {
    setCurrentLineCoordinates([]);
    setCurrentPolygonCoordinates([]);
    setIsDrawing(false);
    clearPreview();
    if (isDrawing) {
      onLog('❌ Drawing cancelled');
    }
  };

  const updateLinePreview = (coordinates) => {
    if (!map || coordinates.length < 2) return;

    clearPreview();

    const previewLine = L.polyline(
      coordinates.map(coord => [coord[1], coord[0]]),
      {
        color: '#ff0000',
        weight: 3,
        dashArray: '5, 5',
        opacity: 0.8
      }
    );

    previewLine.addTo(map);
    setCurrentDrawingLayer(previewLine);
  };

  const updatePolygonPreview = (coordinates) => {
    if (!map || coordinates.length < 3) return;

    clearPreview();

    const previewPolygon = L.polygon(
      coordinates.map(coord => [coord[1], coord[0]]),
      {
        color: '#ff0000',
        weight: 3,
        fillColor: '#ff0000',
        fillOpacity: 0.3,
        dashArray: '5, 5',
        opacity: 0.8
      }
    );

    previewPolygon.addTo(map);
    setCurrentDrawingLayer(previewPolygon);
  };

  const clearPreview = () => {
    if (currentDrawingLayer && map) {
      map.removeLayer(currentDrawingLayer);
      setCurrentDrawingLayer(null);
    }
  };

  const calculateLineLength = (coordinates) => {
    let length = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lng1, lat1] = coordinates[i - 1];
      const [lng2, lat2] = coordinates[i];
      length += Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));
    }
    return (length * 111).toFixed(2);
  };

  const calculatePolygonArea = (coordinates) => {
    return ((coordinates.length - 1) * 0.1).toFixed(2);
  };

  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, []);

  return null;
};

// Component to fit map bounds to layers
const FitBounds = ({ layers }) => {
  const map = useMap();
  
  useEffect(() => {
    const visibleLayers = layers.filter(layer => layer.visible && layer.data?.features?.length > 0);
    
    if (visibleLayers.length > 0) {
      const bounds = new L.LatLngBounds();
      let hasValidBounds = false;
      
      visibleLayers.forEach(layer => {
        if (layer.data?.features) {
          layer.data.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
              try {
                const geoJsonLayer = L.geoJSON(feature);
                const layerBounds = geoJsonLayer.getBounds();
                if (layerBounds.isValid()) {
                  bounds.extend(layerBounds);
                  hasValidBounds = true;
                }
              } catch (error) {
                console.warn('Error calculating bounds for feature:', error);
              }
            }
          });
        }
      });
      
      if (hasValidBounds) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [map, layers]);
  
  return null;
};

// Component for displaying layer information
const LayerInfo = ({ layers }) => {
  const visibleCount = layers.filter(l => l.visible).length;
  const totalFeatures = layers.reduce((sum, layer) => {
    return sum + (layer.data?.features?.length || 0);
  }, 0);
  
  return (
    <div className="map-info-panel">
      <div className="map-info-item">
        <strong>{visibleCount}</strong> visible layers
      </div>
      <div className="map-info-item">
        <strong>{totalFeatures}</strong> total features
      </div>
    </div>
  );
};

// Map Drawing Handler Component - Groups features by type
const MapDrawingHandler = ({ selectedTool, onLog, setLayers, layers }) => {
  
  const getLayerNameByType = (featureType) => {
    switch (featureType) {
      case 'Point':
        return 'POI Layer';
      case 'LineString':
        return 'Lines Layer';
      case 'Polygon':
        return 'Polygons Layer';
      default:
        return `${featureType} Layer`;
    }
  };

  const getColorByType = (featureType) => {
    switch (featureType) {
      case 'Point':
        return '#e74c3c';
      case 'LineString':
        return '#3498db';
      case 'Polygon':
        return '#2ecc71';
      default:
        return '#007cbf';
    }
  };

  const handleAddFeature = (feature) => {
    try {
      console.log('🔧 Adding feature:', feature);
      
      const featureType = feature.geometry.type;
      const layerName = getLayerNameByType(featureType);
      
      onLog(`🔍 Processing ${featureType} feature...`);
      
      // FIXED: Ensure state updates properly trigger re-renders
      setLayers(currentLayers => {
        console.log('📊 Current layers before update:', currentLayers);
        
        const existingLayerIndex = currentLayers.findIndex(layer => 
          layer.source === 'drawn' && layer.type === featureType
        );

        let updatedLayers;

        if (existingLayerIndex !== -1) {
          // Add to existing layer
          onLog(`📝 Adding to existing "${layerName}" layer...`);
          
          updatedLayers = [...currentLayers];
          const existingLayer = updatedLayers[existingLayerIndex];
          
          const updatedFeatures = [...existingLayer.data.features, feature];
          
          // ENSURE new object reference for React to detect change
          updatedLayers[existingLayerIndex] = {
            ...existingLayer,
            id: existingLayer.id, // Keep same ID
            data: {
              type: 'FeatureCollection',
              features: updatedFeatures
            },
            metadata: {
              ...existingLayer.metadata,
              featureCount: updatedFeatures.length,
              lastUpdated: new Date().toISOString()
            },
            properties: {
              ...existingLayer.properties,
              featureCount: updatedFeatures.length,
              lastUpdated: new Date().toLocaleDateString()
            }
          };
          
          console.log('📋 Updated layer with features:', updatedLayers[existingLayerIndex].data.features);
          onLog(`✅ Added ${featureType} to "${layerName}" (${updatedFeatures.length} features total)`);
          
        } else {
          // Create new layer
          onLog(`🆕 Creating new "${layerName}" layer...`);
          
          const newLayer = {
            id: `drawn-${featureType.toLowerCase()}-${Date.now()}`,
            name: layerName,
            type: featureType,
            visible: true,
            selected: false,
            selectedForOperation: false,
            color: getColorByType(featureType),
            data: {
              type: 'FeatureCollection',
              features: [feature]
            },
            metadata: {
              featureCount: 1,
              geometryTypes: [featureType],
              created: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              bounds: calculateFeatureBounds(feature)
            },
            properties: {
              featureCount: 1,
              uploadDate: new Date().toLocaleDateString(),
              lastUpdated: new Date().toLocaleDateString(),
              fileSize: '< 1 KB',
              geometryTypes: [featureType]
            },
            source: 'drawn'
          };

          updatedLayers = [...currentLayers, newLayer];
          console.log('🆕 New layer created with features:', newLayer.data.features);
          onLog(`✅ Created "${layerName}" layer with first ${featureType}`);
        }
        
        console.log('📊 Final updated layers:', updatedLayers);
        return updatedLayers;
      });

    } catch (error) {
      onLog(`❌ Error adding feature: ${error.message}`);
      console.error('❌ Full error details:', error);
    }
  };

  const calculateFeatureBounds = (feature) => {
    try {
      const coords = feature.geometry.coordinates;
      if (feature.geometry.type === 'Point') {
        return {
          minLng: coords[0],
          maxLng: coords[0],
          minLat: coords[1],
          maxLat: coords[1]
        };
      }
      // For other geometry types
      const flatCoords = Array.isArray(coords[0]) ? coords.flat(2) : coords;
      const lngs = flatCoords.filter((_, i) => i % 2 === 0);
      const lats = flatCoords.filter((_, i) => i % 2 === 1);
      
      return {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats)
      };
    } catch (error) {
      console.warn('Error calculating bounds:', error);
      return null;
    }
  };

  const handleClearCanvas = () => {
    if (selectedTool === 'clear-canvas') {
      const drawnLayers = layers.filter(layer => layer.source === 'drawn');
      const totalFeatures = drawnLayers.reduce((sum, layer) => sum + (layer.data?.features?.length || 0), 0);
      
      setLayers(prevLayers => prevLayers.filter(layer => layer.source !== 'drawn'));
      onLog(`🗑️ Canvas cleared - ${drawnLayers.length} drawn layers removed (${totalFeatures} features total)`);
    }
  };

  useEffect(() => {
    handleClearCanvas();
  }, [selectedTool]);

  // Only render DrawingHandler for drawing tools
  if (['draw-point', 'draw-line', 'draw-polygon'].includes(selectedTool)) {
    return (
      <DrawingHandler
        selectedTool={selectedTool}
        onAddFeature={handleAddFeature}
        onLog={onLog}
      />
    );
  }

  return null;
};

// Main MapCanvas Component
const MapCanvas = ({ selectedTool, layers, onLog, highlightResults = null, setLayers }) => {
  const [mapCenter] = useState([51.505, -0.09]);
  const [mapZoom] = useState(13);
  const mapRef = useRef();

  // ADD: Force re-render key when layers change
  const [renderKey, setRenderKey] = useState(0);

  // ADD: Effect to trigger re-render when layers change
  useEffect(() => {
    console.log('🔄 Layers changed, updating map render key');
    setRenderKey(prev => prev + 1);
  }, [layers]);

  const onFeatureClick = (feature, layer, layerInfo) => {
    if (selectedTool === 'select') {
      const coordinates = feature.geometry.coordinates;
      const properties = feature.properties || {};
      
      onLog(`Selected feature from layer "${layerInfo.name}": ${JSON.stringify(properties)}`);
      
      const popupContent = `
        <div class="feature-popup">
          <h4>Feature Details</h4>
          <p><strong>Layer:</strong> ${layerInfo.name}</p>
          <p><strong>Type:</strong> ${feature.geometry.type}</p>
          ${Object.keys(properties).length > 0 ? 
            '<p><strong>Properties:</strong></p>' + 
            Object.entries(properties)
              .slice(0, 5)
              .map(([key, value]) => `<div>${key}: ${value}</div>`)
              .join('') +
            (Object.keys(properties).length > 5 ? '<div>... and more</div>' : '')
            : '<p>No properties</p>'
          }
        </div>
      `;
      
      layer.bindPopup(popupContent).openPopup();
    }
  };

  const getLayerStyle = (layerInfo, isHighlight = false) => {
    const baseStyle = {
      color: layerInfo.color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3,
      fillColor: layerInfo.color,
    };

    if (isHighlight) {
      return {
        ...baseStyle,
        color: '#ff6b6b',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.5,
        dashArray: '5, 5'
      };
    }

    if (layerInfo.selectedForOperation) {
      return {
        ...baseStyle,
        color: '#27ae60',
        weight: 3,
        dashArray: '10, 5'
      };
    }

    return baseStyle;
  };

  const pointToLayer = (feature, latlng, layerInfo) => {
    const marker = L.circleMarker(latlng, {
      radius: 6,
      fillColor: layerInfo.color,
      color: layerInfo.color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.6
    });

    marker.on('click', () => {
      onFeatureClick(feature, marker, layerInfo);
    });

    return marker;
  };

  return (
    <div className="map-canvas-container">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="map-canvas"
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ZoomControl position="topright" />
        
        {/* FIXED: Add key prop to force re-render and better filtering */}
        {layers
          .filter(layer => {
            const hasFeatures = layer.visible && 
              ((layer.data?.features?.length > 0) || (layer.features?.length > 0));
            console.log(`🔍 Layer "${layer.name}" has features:`, hasFeatures, 
              'Features count:', layer.data?.features?.length || layer.features?.length || 0);
            return hasFeatures;
          })
          .map(layer => {
            // FIXED: Handle both data structures
            const geoJsonData = layer.data || {
              type: 'FeatureCollection',
              features: layer.features || []
            };

            console.log(`🗺️ Rendering layer "${layer.name}" with data:`, geoJsonData);

            return (
              <GeoJSON
                key={`layer-${layer.id}-${renderKey}`} // Force re-render with key
                data={geoJsonData}
                style={(feature) => getLayerStyle(layer, false)}
                pointToLayer={(feature, latlng) => pointToLayer(feature, latlng, layer)}
                onEachFeature={(feature, leafletLayer) => {
                  console.log(`📍 Adding feature to map:`, feature.properties);
                  
                  leafletLayer.on({
                    mouseover: (e) => {
                      e.target.setStyle({
                        weight: 3,
                        color: '#666',
                        fillOpacity: 0.7
                      });
                    },
                    mouseout: (e) => {
                      e.target.setStyle(getLayerStyle(layer, false));
                    },
                    click: (e) => {
                      onFeatureClick(feature, leafletLayer, layer);
                    }
                  });

                  leafletLayer.bindTooltip(
                    `Layer: ${layer.name}${feature.properties?.name ? ` | ${feature.properties.name}` : ''}`,
                    { 
                      permanent: false, 
                      direction: 'top',
                      className: 'feature-tooltip'
                    }
                  );
                }}
              />
            );
          })
        }
        
        {highlightResults && highlightResults.features && (
          <GeoJSON
            key="highlight-results"
            data={highlightResults}
            style={() => ({
              color: '#ff6b6b',
              weight: 3,
              opacity: 1,
              fillOpacity: 0.5,
              fillColor: '#ff6b6b',
              dashArray: '5, 5'
            })}
            pointToLayer={(feature, latlng) => 
              L.circleMarker(latlng, {
                radius: 8,
                fillColor: '#ff6b6b',
                color: '#ff6b6b',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.7
              })
            }
          />
        )}
        
        <FitBounds layers={layers} />
        
        <MapDrawingHandler
          selectedTool={selectedTool}
          onLog={onLog}
          setLayers={setLayers}
          layers={layers}
        />
      </MapContainer>
      
      <LayerInfo layers={layers} />
      
      {selectedTool && (
        <div className="map-tool-indicator">
          <span className="tool-icon">
            {selectedTool === 'select' ? '🔍' : 
             selectedTool === 'union' ? '∪' :
             selectedTool === 'intersection' ? '∩' :
             selectedTool === 'difference' ? '−' :
             selectedTool === 'buffer' ? '○' :
             selectedTool === 'draw-point' ? '📍' :
             selectedTool === 'draw-line' ? '📏' :
             selectedTool === 'draw-polygon' ? '⬟' :
             selectedTool === 'clear-canvas' ? '🗑️' : '🛠️'}
          </span>
          <span className="tool-name">{selectedTool.replace('-', ' ')}</span>
        </div>
      )}
    </div>
  );
};

export default MapCanvas;