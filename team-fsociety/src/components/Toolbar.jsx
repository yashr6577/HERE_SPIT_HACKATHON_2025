import React, { useRef } from 'react';
import useDrivePicker from 'react-google-drive-picker';

const Toolbar = ({ selectedTool, onToolSelect, onLog, layers, onFileUpload, onExport }) => {
  const fileInputRef = useRef(null);
  
  // Google Drive Picker configuration with proper scopes
  const [openPicker, authResponse] = useDrivePicker();

  const gisTools = [
    { id: 'select', name: 'Select', icon: '🔍', category: 'navigation' },
    { id: 'union', name: 'Union', icon: '∪', category: 'operation' },
    { id: 'intersection', name: 'Intersection', icon: '∩', category: 'operation' },
    { id: 'difference', name: 'Difference', icon: '−', category: 'operation' },
    { id: 'buffer', name: 'Buffer', icon: '○', category: 'operation' },
    // NEW: Drawing tools instead of spatial join
    { id: 'draw-point', name: 'Draw POI', icon: '📍', category: 'drawing' },
    { id: 'draw-line', name: 'Draw Line', icon: '📏', category: 'drawing' },
    { id: 'draw-polygon', name: 'Draw Polygon', icon: '⬟', category: 'drawing' },
    { id: 'clear-canvas', name: 'Clear Canvas', icon: '🗑️', category: 'drawing' }
  ];

  const handleToolClick = (toolId) => {
    onToolSelect(toolId);
    const tool = gisTools.find(t => t.id === toolId);
    onLog(`Selected tool: ${tool?.name}`);
    
    // Special handling for drawing tools
    if (toolId === 'clear-canvas') {
      onLog('🗑️ Clearing drawing canvas...');
      // This will be handled by the parent component
    } else if (tool?.category === 'drawing') {
      onLog(`🖊️ Drawing mode activated: ${tool.name}`);
    }
  };

  // Local file upload handler
  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onLog(`Uploading local file: ${file.name}`);
      if (onFileUpload) {
        onFileUpload(file);
      }
    }
    event.target.value = '';
  };

  // Google Drive upload handler
  const handleGoogleDriveUpload = () => {
    onLog('Opening Google Drive picker...');
    
    openPicker({
      clientId: "195986297453-8vhc788edm7i459cdul74992ha8ccbi9.apps.googleusercontent.com",
      developerKey: "AIzaSyB8bVPtiBI5MMoSFLcrnkHgxoaP6cbEEwo",
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      callbackFunction: async (data) => {
        if (data.action === 'cancel') {
          onLog('Google Drive picker cancelled');
          return;
        }
        
        if (data.action === 'picked' && data.docs && data.docs.length > 0) {
          const selectedFile = data.docs[0];
          onLog(`Selected file from Google Drive: ${selectedFile.name}`);
          
          try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${selectedFile.id}?alt=media`, {
              headers: {
                'Authorization': `Bearer ${authResponse.access_token}`
              }
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const file = new File([blob], selectedFile.name, { type: selectedFile.mimeType });
              
              onLog(`Successfully downloaded from Google Drive: ${file.name}`);
              
              if (onFileUpload) {
                onFileUpload(file);
              }
            } else {
              onLog(`Failed to download file from Google Drive: ${response.statusText}`);
            }
          } catch (error) {
            onLog(`Error downloading file from Google Drive: ${error.message}`);
          }
        }
      },
    });
  };

  // NEW: Local Export Handler
  const handleLocalExport = () => {
    if (layers.length === 0) {
      onLog('No layers to export');
      return;
    }

    const selectedLayers = layers.filter(layer => layer.selectedForOperation || layer.visible);
    if (selectedLayers.length === 0) {
      onLog('No visible or selected layers to export');
      return;
    }

    onLog(`Exporting ${selectedLayers.length} layer(s) locally...`);
    
    // Prepare export data
    let exportData;
    
    if (onExport && typeof onExport === 'function') {
      exportData = onExport(selectedLayers, false); // false = local export
    }
    
    if (!exportData) {
      exportData = {
        type: "FeatureCollection",
        features: selectedLayers.map(layer => ({
          type: "Feature",
          properties: {
            name: layer.name || "Exported Layer",
            id: layer.id,
            visible: layer.visible,
            selectedForOperation: layer.selectedForOperation
          },
          geometry: layer.geometry || {
            type: "Point",
            coordinates: [0, 0]
          }
        }))
      };
    }

    const exportString = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gis-export-${timestamp}.geojson`;

    // Download locally
    downloadLocally(exportString, filename);
  };

  // NEW: Save to Google Drive Handler
  const handleSaveToDrive = () => {
    if (layers.length === 0) {
      onLog('No layers to save');
      return;
    }

    const selectedLayers = layers.filter(layer => layer.selectedForOperation || layer.visible);
    if (selectedLayers.length === 0) {
      onLog('No visible or selected layers to save');
      return;
    }

    onLog(`Saving ${selectedLayers.length} layer(s) to Google Drive...`);
    handleSaveToGoogleDrive(selectedLayers);
  };

  // Save to Google Drive function
  const handleSaveToGoogleDrive = (selectedLayers) => {
    onLog('Preparing save data...');
    
    // Prepare save data
    let saveData;
    
    if (onExport && typeof onExport === 'function') {
      saveData = onExport(selectedLayers, true); // true = cloud save
    }
    
    if (!saveData) {
      saveData = {
        type: "FeatureCollection",
        features: selectedLayers.map(layer => ({
          type: "Feature",
          properties: {
            name: layer.name || "Saved Layer",
            id: layer.id,
            visible: layer.visible,
            selectedForOperation: layer.selectedForOperation
          },
          geometry: layer.geometry || {
            type: "Point",
            coordinates: [0, 0]
          }
        }))
      };
    }

    const saveString = JSON.stringify(saveData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gis-save-${timestamp}.geojson`;

    // Check authentication first
    if (!authResponse || !authResponse.access_token) {
      onLog('❌ Google Drive authentication required. Please try uploading a file first to authenticate.');
      return;
    }

    onLog(`📤 Starting upload: ${filename}`);

    // Direct upload to Google Drive root folder
    const uploadToGoogleDrive = async () => {
      try {
        // Create file metadata
        const metadata = {
          name: filename,
          parents: ['root'],
          mimeType: 'application/json'
        };

        // Create form data for multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const body = delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          saveString +
          close_delim;

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authResponse.access_token}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`
          },
          body: body
        });

        if (response.ok) {
          const result = await response.json();
          onLog(`✅ Successfully saved to Google Drive: ${filename}`);
          onLog(`🔗 File ID: ${result.id}`);
        } else {
          const errorText = await response.text();
          onLog(`❌ Upload failed: ${response.status} ${errorText}`);
          downloadLocally(saveString, filename);
        }
      } catch (error) {
        onLog(`❌ Google Drive upload failed: ${error.message}`);
        downloadLocally(saveString, filename);
      }
    };

    uploadToGoogleDrive();
  };

  // Fallback function for local download
  const downloadLocally = (content, filename) => {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onLog(`📥 Downloaded locally: ${filename}`);
    } catch (error) {
      onLog(`❌ Local download failed: ${error.message}`);
    }
  };

  const getOperationButtonsDisabled = () => {
    const selectedForOperation = layers.filter(layer => layer.selectedForOperation);
    return selectedForOperation.length < 2;
  };

  return (
    <div className="toolbar">
      {/* Brand Section */}
      <div className="toolbar-brand">
        <h2>🗺️ GIS Tool</h2>
      </div>

      {/* File Operations Section */}
      <div className="toolbar-section">
        <div className="toolbar-section-label">File</div>
        <div className="toolbar-buttons">
          {/* Local File Upload */}
          <button
            className="toolbar-button file-upload"
            onClick={handleFileUploadClick}
            title="Upload local GIS file (GeoJSON, KML, GPX, Shapefile)"
          >
            <span className="button-icon">📁</span>
            <span className="button-text">Upload File</span>
          </button>

          {/* Google Drive Upload */}
          <button
            className="toolbar-button gdrive-upload"
            onClick={handleGoogleDriveUpload}
            title="Upload file from Google Drive"
          >
            <span className="button-icon">☁️📂</span>
            <span className="button-text">Upload from GDrive</span>
          </button>
          
          {/* Save to Drive Button */}
          <button
            className="toolbar-button save-to-drive"
            onClick={handleSaveToDrive}
            disabled={layers.length === 0}
            title={`Save ${layers.filter(l => l.visible || l.selectedForOperation).length} layer(s) to Google Drive`}
          >
            <span className="button-icon">☁️💾</span>
            <span className="button-text">Save to Drive</span>
          </button>

          {/* Local Export Button */}
          <button
            className="toolbar-button export-local"
            onClick={handleLocalExport}
            disabled={layers.length === 0}
            title={`Export ${layers.filter(l => l.visible || l.selectedForOperation).length} layer(s) locally`}
          >
            <span className="button-icon">💾</span>
            <span className="button-text">Export</span>
          </button>
        </div>
      </div>

      {/* GIS Operations Section */}
      <div className="toolbar-section">
        <div className="toolbar-section-label">Operations</div>
        <div className="toolbar-buttons">
          {/* Navigation Tools */}
          {gisTools.filter(tool => tool.category === 'navigation').map(tool => (
            <button
              key={tool.id}
              className={`toolbar-button tool-button ${selectedTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.id)}
              title={tool.name}
            >
              <span className="button-icon">{tool.icon}</span>
              <span className="button-text">{tool.name}</span>
            </button>
          ))}
          
          {/* Separator */}
          <div className="toolbar-separator"></div>
          
          {/* GIS Operation Tools */}
          {gisTools.filter(tool => tool.category === 'operation').map(tool => (
            <button
              key={tool.id}
              className={`toolbar-button tool-button operation-tool ${selectedTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.id)}
              disabled={tool.id !== 'buffer' && getOperationButtonsDisabled()}
              title={
                tool.id !== 'buffer' && getOperationButtonsDisabled()
                  ? `${tool.name} - Select 2+ layers for operation`
                  : tool.name
              }
            >
              <span className="button-icon">{tool.icon}</span>
              <span className="button-text">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* NEW: Drawing Tools Section */}
      <div className="toolbar-section">
        <div className="toolbar-section-label">Drawing</div>
        <div className="toolbar-buttons">
          {gisTools.filter(tool => tool.category === 'drawing').map(tool => (
            <button
              key={tool.id}
              className={`toolbar-button tool-button drawing-tool ${selectedTool === tool.id ? 'active' : ''}`}
              onClick={() => handleToolClick(tool.id)}
              title={tool.name}
            >
              <span className="button-icon">{tool.icon}</span>
              <span className="button-text">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Section */}
      <div className="toolbar-status">
        <div className="status-item">
          <span className="status-label">Layers:</span>
          <span className="status-value">{layers.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Selected:</span>
          <span className="status-value">
            {layers.filter(layer => layer.selectedForOperation).length}
          </span>
        </div>
        {selectedTool && (
          <div className="status-item active-tool">
            <span className="status-label">Tool:</span>
            <span className="status-value">
              {gisTools.find(t => t.id === selectedTool)?.name}
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input for local uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.kml,.gpx,.shp,.zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        multiple={false}
      />
    </div>
  );
};

export default Toolbar;