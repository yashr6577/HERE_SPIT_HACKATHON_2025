import { performIntersection, performMultipleIntersection, findAllIntersections } from './intersection.js';
import { performUnion } from './union.js';
import { performDifference } from './difference.js';
import { performBuffer } from './buffer.js';
import { performSpatialJoin } from './spatialJoin.js';
import { generateRandomColor } from '../../utils/colorUtils.js';

/**
 * Execute GIS operation based on selected tool and layers
 * @param {string} operation - Operation type (union, intersection, etc.)
 * @param {Array} selectedLayers - Array of selected layer objects
 * @param {Object} options - Operation options
 * @returns {Object} Operation result
 */
export const executeGISOperation = (operation, selectedLayers, options = {}) => {
  try {
    // Extract features from selected layers
    const allFeatures = [];
    selectedLayers.forEach(layer => {
      if (layer.data && layer.data.features) {
        allFeatures.push(...layer.data.features);
      }
    });

    if (allFeatures.length === 0) {
      throw new Error('No features found in selected layers');
    }

    let result = null;

    switch (operation) {
      case 'intersection':
        if (allFeatures.length < 2) {
          throw new Error('Intersection requires at least 2 features');
        }
        if (allFeatures.length === 2) {
          result = performIntersection(allFeatures[0], allFeatures[1], options);
        } else {
          result = performMultipleIntersection(allFeatures, options);
        }
        break;

      case 'union':
        result = performUnion(allFeatures, options);
        break;

      case 'difference':
        if (allFeatures.length < 2) {
          throw new Error('Difference requires at least 2 features');
        }
        result = performDifference(allFeatures,options);
        break;

      case 'buffer':
        const distance = options.distance || 1000; // default 1km
        result = performBuffer(allFeatures, distance, options);
        break;

      case 'spatial-join':
        const pointFeatures = allFeatures.filter(f => 
          ['Point', 'MultiPoint'].includes(f.geometry?.type)
        );
        const polygonFeatures = allFeatures.filter(f => 
          ['Polygon', 'MultiPolygon'].includes(f.geometry?.type)
        );
        result = performSpatialJoin(pointFeatures, polygonFeatures, options);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    // Create result layer
    const resultLayer = {
      id: Date.now(),
      name: `${operation}_result_${new Date().toLocaleTimeString()}`,
      visible: true,
      color: generateRandomColor(),
      type: 'result',
      selected: false,
      selectedForOperation: false,
      data: result.result,
      metadata: result.metadata,
      properties: {
        featureCount: result.result.features.length,
        operation: operation,
        inputLayers: selectedLayers.map(l => l.name),
        createdDate: new Date().toLocaleDateString(),
        ...result.metadata
      }
    };

    return {
      success: true,
      resultLayer,
      metadata: result.metadata,
      message: `${operation} completed successfully: ${result.result.features.length} features created`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      operation
    };
  }
};