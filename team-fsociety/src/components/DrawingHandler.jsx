import { useEffect, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';

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

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        cancelDrawing();
      } else if (e.key === 'Enter') {
        finishDrawing();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentLineCoordinates, currentPolygonCoordinates]);

  const handleDrawPoint = (lng, lat) => {
    console.log('🎯 Drawing point at:', lng, lat);
    console.log('🔧 onAddFeature function:', typeof onAddFeature);
    
    const pointFeature = {
      type: 'Feature',
      properties: {
        name: `POI ${new Date().toLocaleTimeString()}`,
        type: 'point',
        created: new Date().toISOString(),
        description: 'Point of Interest',
        id: `poi-${Date.now()}`
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    };

    console.log('📍 Point feature created:', pointFeature);
    
    // MAKE SURE this function is called
    if (typeof onAddFeature === 'function') {
      onAddFeature(pointFeature);
      onLog(`✅ POI added at [${lng.toFixed(6)}, ${lat.toFixed(6)}]`);
    } else {
      console.error('❌ onAddFeature is not a function:', onAddFeature);
      onLog(`❌ Failed to add POI - callback error`);
    }
  };

  const handleDrawLine = (lng, lat) => {
    const newCoords = [...currentLineCoordinates, [lng, lat]];
    setCurrentLineCoordinates(newCoords);

    if (newCoords.length === 1) {
      onLog(`📏 Line started. Click to add more points, press Enter to finish`);
      setIsDrawing(true);
    } else {
      onLog(`📏 Added point ${newCoords.length}. Press Enter to finish line`);
    }

    // Update preview line on map
    updateLinePreview(newCoords);
  };

  const handleDrawPolygon = (lng, lat) => {
    const newCoords = [...currentPolygonCoordinates, [lng, lat]];
    setCurrentPolygonCoordinates(newCoords);

    if (newCoords.length === 1) {
      onLog(`⬟ Polygon started. Click to add more points, press Enter to finish`);
      setIsDrawing(true);
    } else {
      onLog(`⬟ Added point ${newCoords.length}. Press Enter to finish polygon`);
    }

    // Update preview polygon on map
    updatePolygonPreview(newCoords);
  };

  const finishDrawing = () => {
    if (selectedTool === 'draw-line' && currentLineCoordinates.length >= 2) {
      const lineFeature = {
        type: 'Feature',
        properties: {
          name: `Line ${new Date().toLocaleTimeString()}`,
          type: 'line',
          created: new Date().toISOString(),
          length_km: calculateLineLength(currentLineCoordinates)
        },
        geometry: {
          type: 'LineString',
          coordinates: currentLineCoordinates
        }
      };

      onAddFeature(lineFeature);
      onLog(`✅ Line completed with ${currentLineCoordinates.length} points`);
      setCurrentLineCoordinates([]);
      setIsDrawing(false);
      clearPreview();
    } else if (selectedTool === 'draw-polygon' && currentPolygonCoordinates.length >= 3) {
      // Close the polygon
      const closedCoords = [...currentPolygonCoordinates, currentPolygonCoordinates[0]];
      
      const polygonFeature = {
        type: 'Feature',
        properties: {
          name: `Polygon ${new Date().toLocaleTimeString()}`,
          type: 'polygon',
          created: new Date().toISOString(),
          area_km2: calculatePolygonArea(closedCoords)
        },
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords]
        }
      };

      onAddFeature(polygonFeature);
      onLog(`✅ Polygon completed with ${currentPolygonCoordinates.length} points`);
      setCurrentPolygonCoordinates([]);
      setIsDrawing(false);
      clearPreview();
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

    // Remove existing preview
    clearPreview();

    // Create preview line
    const previewLine = L.polyline(
      coordinates.map(coord => [coord[1], coord[0]]), // Leaflet expects [lat, lng]
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

    // Remove existing preview
    clearPreview();

    // Create preview polygon
    const previewPolygon = L.polygon(
      coordinates.map(coord => [coord[1], coord[0]]), // Leaflet expects [lat, lng]
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
    // Simple distance calculation
    let length = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lng1, lat1] = coordinates[i - 1];
      const [lng2, lat2] = coordinates[i];
      length += Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));
    }
    return (length * 111).toFixed(2); // Rough conversion to km
  };

  const calculatePolygonArea = (coordinates) => {
    // Simple area calculation placeholder
    return ((coordinates.length - 1) * 0.1).toFixed(2);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default DrawingHandler;