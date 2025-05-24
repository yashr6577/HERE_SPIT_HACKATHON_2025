import * as turf from '@turf/turf';

/**
 * Parse GeoJSON file and convert to Turf.js compatible format
 * @param {File|string|Object} input - GeoJSON file, string, or object
 * @returns {Promise<Object>} Parsed result with features and metadata
 */
export const parseGeoJSON = async (input) => {
  try {
    let geojsonData;
    
    // Handle different input types
    if (input instanceof File) {
      const text = await input.text();
      geojsonData = JSON.parse(text);
    } else if (typeof input === 'string') {
      geojsonData = JSON.parse(input);
    } else if (typeof input === 'object') {
      geojsonData = input;
    } else {
      throw new Error('Invalid input type for GeoJSON parser');
    }

    // Validate GeoJSON structure
    if (!geojsonData || typeof geojsonData !== 'object') {
      throw new Error('Invalid GeoJSON format');
    }

    // Ensure we have a FeatureCollection
    let featureCollection;
    if (geojsonData.type === 'FeatureCollection') {
      featureCollection = geojsonData;
    } else if (geojsonData.type === 'Feature') {
      featureCollection = {
        type: 'FeatureCollection',
        features: [geojsonData]
      };
    } else if (geojsonData.type && ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'].includes(geojsonData.type)) {
      // Raw geometry
      featureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: geojsonData,
          properties: {}
        }]
      };
    } else {
      throw new Error('Unrecognized GeoJSON structure');
    }

    // Validate and convert features to Turf.js format
    const validFeatures = [];
    const errors = [];

    featureCollection.features.forEach((feature, index) => {
      try {
        // Validate feature structure
        if (!feature || feature.type !== 'Feature') {
          throw new Error(`Invalid feature at index ${index}`);
        }

        if (!feature.geometry) {
          throw new Error(`Feature at index ${index} missing geometry`);
        }

        // Convert to Turf.js feature and validate
        const turfFeature = turf.feature(
          feature.geometry,
          feature.properties || {},
          { id: feature.id || index }
        );

        // Additional geometry validation
        if (!turf.booleanValid(turfFeature)) {
          console.warn(`Invalid geometry at feature ${index}, attempting to repair`);
          // Try to clean the geometry
          try {
            const cleaned = turf.cleanCoords(turfFeature);
            validFeatures.push(cleaned);
          } catch (cleanError) {
            throw new Error(`Cannot repair geometry at index ${index}: ${cleanError.message}`);
          }
        } else {
          validFeatures.push(turfFeature);
        }

      } catch (featureError) {
        errors.push({
          index,
          error: featureError.message,
          feature: feature
        });
      }
    });

    // Calculate bounds and metadata
    let bounds = null;
    let centroid = null;
    let area = 0;
    let length = 0;

    if (validFeatures.length > 0) {
      try {
        const collection = turf.featureCollection(validFeatures);
        bounds = turf.bbox(collection);
        centroid = turf.centroid(collection);
        
        // Calculate total area and length
        validFeatures.forEach(feature => {
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
    const geometryTypes = [...new Set(validFeatures.map(f => f.geometry.type))];

    // Extract property keys
    const propertyKeys = new Set();
    validFeatures.forEach(feature => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach(key => propertyKeys.add(key));
      }
    });

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: validFeatures
      },
      metadata: {
        featureCount: validFeatures.length,
        geometryTypes,
        propertyKeys: Array.from(propertyKeys),
        bounds,
        centroid: centroid ? centroid.geometry.coordinates : null,
        area: area > 0 ? area : null,
        length: length > 0 ? length : null,
        crs: featureCollection.crs || null,
        errors: errors.length > 0 ? errors : null
      },
      format: 'geojson'
    };

  } catch (error) {
    return {
      success: false,
      error: `GeoJSON parsing failed: ${error.message}`,
      format: 'geojson'
    };
  }
};

/**
 * Validate GeoJSON string or object
 * @param {string|Object} geojson - GeoJSON to validate
 * @returns {Object} Validation result
 */
export const validateGeoJSON = (geojson) => {
  try {
    const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
    
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid JSON structure' };
    }

    if (!parsed.type) {
      return { valid: false, error: 'Missing type property' };
    }

    const validTypes = ['FeatureCollection', 'Feature', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'];
    if (!validTypes.includes(parsed.type)) {
      return { valid: false, error: `Invalid type: ${parsed.type}` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};