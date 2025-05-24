import { parse as terraformerParseWKT, convert } from 'terraformer-wkt-parser';
import * as turf from '@turf/turf';

/**
 * Parse WKT (Well-Known Text) string into GeoJSON geometry
 * @param {string} wktString - WKT formatted geometry string
 * @param {Object} properties - Optional properties for the feature
 * @returns {Object} Parsed result with geometry and metadata
 */
export const parseWKT = (wktString, properties = {}) => {
  try {
    if (!wktString || typeof wktString !== 'string') {
      throw new Error('Invalid WKT input: must be a non-empty string');
    }

    // Clean and validate WKT string
    const cleanWKT = wktString.trim();
    if (!cleanWKT) {
      throw new Error('Empty WKT string');
    }

    // Parse WKT using terraformer (renamed to avoid conflict)
    const geojsonGeometry = terraformerParseWKT(cleanWKT);
    
    if (!geojsonGeometry) {
      throw new Error('Failed to parse WKT string');
    }

    // Create feature with Turf.js
    const feature = turf.feature(geojsonGeometry, properties);

    // Validate geometry
    if (!turf.booleanValid(feature)) {
      console.warn('Invalid geometry detected, attempting to repair');
      try {
        const cleaned = turf.cleanCoords(feature);
        feature.geometry = cleaned.geometry;
      } catch (cleanError) {
        throw new Error(`Cannot repair geometry: ${cleanError.message}`);
      }
    }

    // Calculate metadata
    let bounds = null;
    let centroid = null;
    let area = null;
    let length = null;

    try {
      bounds = turf.bbox(feature);
      centroid = turf.centroid(feature);
      
      if (['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
        area = turf.area(feature);
      }
      
      if (['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
        length = turf.length(feature, { units: 'kilometers' });
      }
    } catch (metaError) {
      console.warn('Error calculating metadata:', metaError);
    }

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: [feature]
      },
      metadata: {
        featureCount: 1,
        geometryType: feature.geometry.type,
        bounds,
        centroid: centroid ? centroid.geometry.coordinates : null,
        area,
        length,
        originalWKT: cleanWKT
      },
      format: 'wkt'
    };

  } catch (error) {
    return {
      success: false,
      error: `WKT parsing failed: ${error.message}`,
      format: 'wkt'
    };
  }
};

/**
 * Parse multiple WKT strings from text
 * @param {string} text - Text containing multiple WKT geometries
 * @param {string} delimiter - Delimiter between WKT strings (default: newline)
 * @returns {Object} Parsed result with multiple features
 */
export const parseMultipleWKT = (text, delimiter = '\n') => {
  try {
    const wktStrings = text.split(delimiter)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (wktStrings.length === 0) {
      throw new Error('No valid WKT strings found');
    }

    const features = [];
    const errors = [];

    wktStrings.forEach((wktString, index) => {
      try {
        const result = parseWKT(wktString, { wkt_index: index });
        if (result.success && result.data.features.length > 0) {
          features.push(result.data.features[0]);
        } else {
          errors.push({
            index,
            wkt: wktString,
            error: result.error || 'Unknown parsing error'
          });
        }
      } catch (error) {
        errors.push({
          index,
          wkt: wktString,
          error: error.message
        });
      }
    });

    if (features.length === 0) {
      throw new Error('No valid features could be parsed');
    }

    // Calculate collective metadata
    let bounds = null;
    let centroid = null;
    let totalArea = 0;
    let totalLength = 0;

    try {
      const collection = turf.featureCollection(features);
      bounds = turf.bbox(collection);
      centroid = turf.centroid(collection);
      
      features.forEach(feature => {
        try {
          if (['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
            totalArea += turf.area(feature);
          }
          if (['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
            totalLength += turf.length(feature, { units: 'kilometers' });
          }
        } catch (calcError) {
          console.warn('Error calculating metrics for feature:', calcError);
        }
      });
    } catch (metaError) {
      console.warn('Error calculating collective metadata:', metaError);
    }

    const geometryTypes = [...new Set(features.map(f => f.geometry.type))];

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: features
      },
      metadata: {
        featureCount: features.length,
        geometryTypes,
        bounds,
        centroid: centroid ? centroid.geometry.coordinates : null,
        totalArea: totalArea > 0 ? totalArea : null,
        totalLength: totalLength > 0 ? totalLength : null,
        errors: errors.length > 0 ? errors : null,
        parsedCount: features.length,
        totalInput: wktStrings.length
      },
      format: 'wkt-multi'
    };

  } catch (error) {
    return {
      success: false,
      error: `Multiple WKT parsing failed: ${error.message}`,
      format: 'wkt-multi'
    };
  }
};

/**
 * Convert GeoJSON geometry to WKT string
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {string} WKT string
 */
export const geometryToWKT = (geometry) => {
  try {
    if (!geometry || !geometry.type) {
      throw new Error('Invalid geometry object');
    }

    return convert(geometry);
  } catch (error) {
    throw new Error(`WKT conversion failed: ${error.message}`);
  }
};

/**
 * Validate WKT string format
 * @param {string} wktString - WKT string to validate
 * @returns {Object} Validation result
 */
export const validateWKT = (wktString) => {
  try {
    if (!wktString || typeof wktString !== 'string') {
      return { valid: false, error: 'Invalid input: must be a string' };
    }

    const cleanWKT = wktString.trim();
    if (!cleanWKT) {
      return { valid: false, error: 'Empty WKT string' };
    }

    // Check basic WKT format
    const wktPattern = /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i;
    if (!wktPattern.test(cleanWKT)) {
      return { valid: false, error: 'Invalid WKT format' };
    }

    // Try parsing
    const geometry = terraformerParseWKT(cleanWKT);
    if (!geometry) {
      return { valid: false, error: 'Failed to parse WKT' };
    }

    return { 
      valid: true, 
      geometryType: geometry.type,
      coordinates: geometry.coordinates
    };

  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Extract geometry type from WKT string
 * @param {string} wktString - WKT string
 * @returns {string|null} Geometry type or null if invalid
 */
export const getWKTGeometryType = (wktString) => {
  try {
    const match = wktString.trim().match(/^(\w+)\s*\(/i);
    return match ? match[1].toUpperCase() : null;
  } catch (error) {
    return null;
  }
};