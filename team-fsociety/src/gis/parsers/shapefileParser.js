import * as shapefile from 'shapefile';
import * as turf from '@turf/turf';

/**
 * Parse Shapefile (.shp, .dbf, .prj) and convert to GeoJSON FeatureCollection
 * @param {File|ArrayBuffer|Object} shpFile - Shapefile (.shp)
 * @param {File|ArrayBuffer} dbfFile - Optional database file (.dbf)
 * @param {File|string} prjFile - Optional projection file (.prj)
 * @returns {Promise<Object>} Parsed result with features and metadata
 */
export const parseShapefile = async (shpFile, dbfFile = null, prjFile = null) => {
  try {
    let shpBuffer, dbfBuffer, prjText = null;

    // Handle different input types for SHP file
    if (shpFile instanceof File) {
      shpBuffer = await shpFile.arrayBuffer();
    } else if (shpFile instanceof ArrayBuffer) {
      shpBuffer = shpFile;
    } else {
      throw new Error('Invalid shapefile input type');
    }

    // Handle DBF file
    if (dbfFile) {
      if (dbfFile instanceof File) {
        dbfBuffer = await dbfFile.arrayBuffer();
      } else if (dbfFile instanceof ArrayBuffer) {
        dbfBuffer = dbfFile;
      }
    }

    // Handle PRJ file
    if (prjFile) {
      if (prjFile instanceof File) {
        prjText = await prjFile.text();
      } else if (typeof prjFile === 'string') {
        prjText = prjFile;
      }
    }

    // Open shapefile
    const source = await shapefile.open(shpBuffer, dbfBuffer);
    
    const features = [];
    const errors = [];
    let recordIndex = 0;

    // Read all records
    while (true) {
      try {
        const result = await source.read();
        
        if (result.done) {
          break;
        }

        const { value } = result;
        
        if (value) {
          // Convert to proper GeoJSON feature
          const feature = {
            type: 'Feature',
            geometry: value.geometry,
            properties: value.properties || {},
            id: recordIndex
          };

          // Validate geometry with Turf.js
          if (feature.geometry) {
            try {
              const turfFeature = turf.feature(feature.geometry, feature.properties, { id: recordIndex });
              
              // Check if geometry is valid
              if (turf.booleanValid(turfFeature)) {
                features.push(turfFeature);
              } else {
                // Try to clean invalid geometry
                try {
                  const cleaned = turf.cleanCoords(turfFeature);
                  features.push(cleaned);
                } catch (cleanError) {
                  errors.push({
                    index: recordIndex,
                    error: `Invalid geometry: ${cleanError.message}`,
                    geometry: feature.geometry
                  });
                }
              }
            } catch (turfError) {
              errors.push({
                index: recordIndex,
                error: `Turf.js validation failed: ${turfError.message}`,
                geometry: feature.geometry
              });
            }
          } else {
            errors.push({
              index: recordIndex,
              error: 'Missing geometry',
              feature: value
            });
          }
        }

        recordIndex++;
      } catch (recordError) {
        errors.push({
          index: recordIndex,
          error: `Record parsing failed: ${recordError.message}`
        });
        recordIndex++;
      }
    }

    // Calculate metadata
    let bounds = null;
    let centroid = null;
    let area = 0;
    let length = 0;

    if (features.length > 0) {
      try {
        const collection = turf.featureCollection(features);
        bounds = turf.bbox(collection);
        centroid = turf.centroid(collection);
        
        // Calculate total area and length
        features.forEach(feature => {
          try {
            if (['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
              area += turf.area(feature);
            }
            if (['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
              length += turf.length(feature, { units: 'kilometers' });
            }
          } catch (calcError) {
            console.warn('Error calculating metrics for feature:', calcError);
          }
        });
      } catch (metaError) {
        console.warn('Error calculating metadata:', metaError);
      }
    }

    // Extract geometry types
    const geometryTypes = [...new Set(features.map(f => f.geometry.type))];

    // Extract property keys
    const propertyKeys = new Set();
    features.forEach(feature => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => propertyKeys.add(key));
      }
    });

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: features
      },
      metadata: {
        featureCount: features.length,
        geometryTypes,
        propertyKeys: Array.from(propertyKeys),
        bounds,
        centroid: centroid ? centroid.geometry.coordinates : null,
        area: area > 0 ? area : null,
        length: length > 0 ? length : null,
        projection: prjText,
        errors: errors.length > 0 ? errors : null,
        totalRecords: recordIndex
      },
      format: 'shapefile'
    };

  } catch (error) {
    return {
      success: false,
      error: `Shapefile parsing failed: ${error.message}`,
      format: 'shapefile'
    };
  }
};

/**
 * Parse Shapefile from ZIP archive
 * @param {File} zipFile - ZIP file containing shapefile components
 * @returns {Promise<Object>} Parsed result
 */
export const parseShapefileFromZip = async (zipFile) => {
  try {
    // This would require a ZIP library like JSZip
    const JSZip = await import('jszip');
    const zip = new JSZip.default();
    
    const zipContent = await zip.loadAsync(zipFile);
    
    let shpFile = null;
    let dbfFile = null;
    let prjFile = null;

    // Extract files from ZIP
    for (const [filename, file] of Object.entries(zipContent.files)) {
      if (!file.dir) {
        const extension = filename.split('.').pop().toLowerCase();
        
        switch (extension) {
          case 'shp':
            shpFile = await file.async('arraybuffer');
            break;
          case 'dbf':
            dbfFile = await file.async('arraybuffer');
            break;
          case 'prj':
            prjFile = await file.async('string');
            break;
        }
      }
    }

    if (!shpFile) {
      throw new Error('No .shp file found in ZIP archive');
    }

    return await parseShapefile(shpFile, dbfFile, prjFile);

  } catch (error) {
    return {
      success: false,
      error: `ZIP Shapefile parsing failed: ${error.message}`,
      format: 'shapefile-zip'
    };
  }
};

/**
 * Validate Shapefile structure
 * @param {ArrayBuffer} shpBuffer - SHP file buffer
 * @returns {Object} Validation result
 */
export const validateShapefile = async (shpBuffer) => {
  try {
    // Check file header
    const view = new DataView(shpBuffer);
    const fileCode = view.getInt32(0, false); // Big endian
    
    if (fileCode !== 9994) {
      return { valid: false, error: 'Invalid shapefile header' };
    }

    const fileLength = view.getInt32(24, false) * 2; // Convert from 16-bit words to bytes
    if (fileLength !== shpBuffer.byteLength) {
      return { valid: false, error: 'File length mismatch' };
    }

    const version = view.getInt32(28, true); // Little endian
    if (version !== 1000) {
      return { valid: false, error: `Unsupported shapefile version: ${version}` };
    }

    const shapeType = view.getInt32(32, true);
    const validShapeTypes = [0, 1, 3, 5, 8, 11, 13, 15, 18, 21, 23, 25, 28, 31];
    
    if (!validShapeTypes.includes(shapeType)) {
      return { valid: false, error: `Invalid shape type: ${shapeType}` };
    }

    return { 
      valid: true, 
      metadata: {
        fileLength,
        version,
        shapeType,
        shapeTypeName: getShapeTypeName(shapeType)
      }
    };

  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Get shape type name from numeric code
 * @param {number} shapeType - Numeric shape type
 * @returns {string} Shape type name
 */
function getShapeTypeName(shapeType) {
  const shapeTypes = {
    0: 'Null Shape',
    1: 'Point',
    3: 'Polyline',
    5: 'Polygon',
    8: 'MultiPoint',
    11: 'PointZ',
    13: 'PolylineZ',
    15: 'PolygonZ',
    18: 'MultiPointZ',
    21: 'PointM',
    23: 'PolylineM',
    25: 'PolygonM',
    28: 'MultiPointM',
    31: 'MultiPatch'
  };
  
  return shapeTypes[shapeType] || 'Unknown';
}