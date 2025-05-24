import * as turf from '@turf/turf';

/**
 * Perform buffer operation on features
 * @param {Array} features - Array of features to buffer
 * @param {number} distance - Buffer distance (default meters)
 * @param {Object} options - Optional parameters
 * @returns {Object} Buffer result with buffered geometries and metadata
 */
export function performBuffer(features, distance = 1000, options = {}) {
  console.log('🔄 Starting buffer operation...');
  console.log('📊 Function called with arguments count:', arguments.length);
  console.log('📊 First argument (features):', features);
  console.log('📊 Features type:', typeof features);
  console.log('📊 Features is array:', Array.isArray(features));
  console.log('📊 Features length:', features?.length);
  console.log('📊 Second argument (distance):', distance);
  console.log('📊 Third argument (options):', options);
  
  // Stack trace to identify caller
  console.log('📍 Function call stack:');
  console.trace();
  
  // Early validation checks
  if (features === undefined) {
    console.error('❌ CRITICAL: features parameter is undefined!');
    return {
      success: false,
      error: 'Features parameter is undefined. Function called without proper arguments.',
      operation: 'buffer'
    };
  }
  
  if (features === null) {
    console.error('❌ CRITICAL: features parameter is null!');
    return {
      success: false,
      error: 'Features parameter is null.',
      operation: 'buffer'
    };
  }
  
  if (!Array.isArray(features)) {
    console.error('❌ CRITICAL: features is not an array!');
    console.error('📊 Actual type:', typeof features);
    console.error('📊 Actual value:', features);
    return {
      success: false,
      error: `Features must be an array, got ${typeof features}`,
      operation: 'buffer'
    };
  }
  
  if (features.length === 0) {
    console.error('❌ CRITICAL: No features provided for buffer operation!');
    return {
      success: false,
      error: 'Buffer requires at least 1 feature to process',
      operation: 'buffer'
    };
  }

  // Validate distance parameter
  if (typeof distance !== 'number' || isNaN(distance)) {
    console.error('❌ CRITICAL: Invalid distance parameter!');
    console.error('📊 Distance type:', typeof distance);
    console.error('📊 Distance value:', distance);
    return {
      success: false,
      error: `Distance must be a number, got ${typeof distance}`,
      operation: 'buffer'
    };
  }

  if (distance === 0) {
    console.warn('⚠️ WARNING: Buffer distance is 0 - no buffering will occur');
  }

  console.log('📊 Input features:', features.length);
  console.log('📏 Buffer distance:', `${distance} ${options.units || 'meters'}`);
  
  // Log each feature details
  features.forEach((feature, index) => {
    try {
      console.log(`📊 Input Feature ${index + 1}:`, {
        exists: !!feature,
        hasGeometry: !!(feature && feature.geometry),
        type: feature?.geometry?.type || 'Unknown',
        properties: feature?.properties?.name || `Feature ${index + 1}`,
        coordinates_length: feature?.geometry?.coordinates?.length || 'N/A',
        area: ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type) ? 
              `${turf.area(feature).toFixed(2)} m²` : 'N/A',
        length: ['LineString', 'MultiLineString'].includes(feature?.geometry?.type) ? 
                `${turf.length(feature, {units: 'kilometers'}).toFixed(3)} km` : 'N/A',
        coordinates: feature?.geometry?.type === 'Point' ? 
                    `[${feature.geometry.coordinates[0].toFixed(6)}, ${feature.geometry.coordinates[1].toFixed(6)}]` : 'Complex'
      });
    } catch (featureError) {
      console.error(`❌ Error analyzing feature ${index + 1}:`, featureError.message);
    }
  });

  try {
    // Analyze feature types
    console.log('🔍 Analyzing feature types for buffering...');
    const featureTypes = {
      points: [],
      lines: [],
      polygons: [],
      others: []
    };

    features.forEach((feature, index) => {
      if (!feature || !feature.geometry) {
        console.warn(`⚠️ Feature ${index + 1}: Missing geometry, skipping`);
        featureTypes.others.push({index, reason: 'Missing geometry'});
        return;
      }

      const geometryType = feature.geometry.type;
      console.log(`🔍 Feature ${index + 1}: ${geometryType}`);

      switch (geometryType) {
        case 'Point':
        case 'MultiPoint':
          featureTypes.points.push({feature, index});
          break;
        case 'LineString':
        case 'MultiLineString':
          featureTypes.lines.push({feature, index, length: turf.length(feature, {units: 'kilometers'})});
          break;
        case 'Polygon':
        case 'MultiPolygon':
          featureTypes.polygons.push({feature, index, area: turf.area(feature)});
          break;
        default:
          featureTypes.others.push({feature, index, type: geometryType});
          console.warn(`⚠️ Feature ${index + 1}: Unsupported geometry type: ${geometryType}`);
      }
    });

    console.log('📊 Feature type analysis:', {
      points: featureTypes.points.length,
      lines: featureTypes.lines.length,
      polygons: featureTypes.polygons.length,
      others: featureTypes.others.length
    });

    // Prepare buffer options
    const bufferOptions = {
      units: options.units || 'meters',
      steps: options.steps || 8, // Number of steps for circle approximation
      ...options
    };

    console.log('📊 Buffer configuration:', {
      distance: `${distance} ${bufferOptions.units}`,
      steps: bufferOptions.steps,
      units: bufferOptions.units
    });

    // Perform buffering
    const operationStartTime = performance.now();
    const resultFeatures = [];
    const bufferSteps = [];
    let totalOriginalArea = 0;
    let totalOriginalLength = 0;
    let totalBufferedArea = 0;

    // Process each feature type
    console.log('⚡ Starting buffer processing...');

    // Buffer Points
    if (featureTypes.points.length > 0) {
      console.log(`🔄 Buffering ${featureTypes.points.length} point features...`);
      featureTypes.points.forEach((pointItem, index) => {
        const result = performPointBuffer(pointItem, distance, bufferOptions, index + 1);
        if (result.success) {
          resultFeatures.push(result.feature);
          bufferSteps.push(result.metadata);
          totalBufferedArea += result.metadata.bufferedArea;
        }
      });
    }

    // Buffer Lines
    if (featureTypes.lines.length > 0) {
      console.log(`🔄 Buffering ${featureTypes.lines.length} line features...`);
      featureTypes.lines.forEach((lineItem, index) => {
        const result = performLineBuffer(lineItem, distance, bufferOptions, index + 1);
        if (result.success) {
          resultFeatures.push(result.feature);
          bufferSteps.push(result.metadata);
          totalOriginalLength += result.metadata.originalLength;
          totalBufferedArea += result.metadata.bufferedArea;
        }
      });
    }

    // Buffer Polygons
    if (featureTypes.polygons.length > 0) {
      console.log(`🔄 Buffering ${featureTypes.polygons.length} polygon features...`);
      featureTypes.polygons.forEach((polygonItem, index) => {
        const result = performPolygonBuffer(polygonItem, distance, bufferOptions, index + 1);
        if (result.success) {
          resultFeatures.push(result.feature);
          bufferSteps.push(result.metadata);
          totalOriginalArea += result.metadata.originalArea;
          totalBufferedArea += result.metadata.bufferedArea;
        }
      });
    }

    const operationEndTime = performance.now();
    const totalExecutionTime = operationEndTime - operationStartTime;

    // Calculate final statistics
    const areaIncrease = totalBufferedArea - totalOriginalArea;
    const areaGrowthPercentage = totalOriginalArea > 0 ? (areaIncrease / totalOriginalArea) * 100 : 0;

    console.log('✅ Buffer operation completed successfully!');
    console.log(`⏱️ Total execution time: ${totalExecutionTime.toFixed(2)}ms`);
    console.log('📤 Final buffer summary:', {
      success: true,
      input_features: features.length,
      output_features: resultFeatures.length,
      buffer_distance: `${distance} ${bufferOptions.units}`,
      total_original_area: `${totalOriginalArea.toFixed(2)} m²`,
      total_buffered_area: `${totalBufferedArea.toFixed(2)} m²`,
      area_increase: `${areaIncrease.toFixed(2)} m²`,
      area_growth: `${areaGrowthPercentage.toFixed(2)}%`,
      total_original_length: `${totalOriginalLength.toFixed(3)} km`,
      execution_time: `${totalExecutionTime.toFixed(2)}ms`,
      successful_buffers: bufferSteps.filter(step => step.success).length,
      failed_buffers: bufferSteps.filter(step => !step.success).length
    });

    return {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: resultFeatures
      },
      metadata: {
        operation: 'buffer',
        inputFeatures: features.length,
        outputFeatures: resultFeatures.length,
        bufferDistance: distance,
        bufferUnits: bufferOptions.units,
        totalOriginalArea,
        totalBufferedArea,
        areaIncrease,
        areaGrowthPercentage,
        totalOriginalLength,
        totalExecutionTime,
        bufferSteps,
        successfulBuffers: bufferSteps.filter(step => step.success).length,
        failedBuffers: bufferSteps.filter(step => !step.success).length,
        featureTypes: {
          points: featureTypes.points.length,
          lines: featureTypes.lines.length,
          polygons: featureTypes.polygons.length,
          others: featureTypes.others.length
        }
      }
    };

  } catch (error) {
    console.error('❌ Buffer operation failed with exception:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      input_features: features?.length || 0,
      feature_types: features?.map(f => f?.geometry?.type) || [],
      buffer_distance: distance,
      buffer_options: options
    });

    return {
      success: false,
      error: `Buffer operation failed: ${error.message}`,
      operation: 'buffer',
      debug: {
        errorType: error.constructor.name,
        errorMessage: error.message,
        inputFeatureCount: features?.length || 0,
        bufferDistance: distance,
        bufferOptions: options
      }
    };
  }
}

/**
 * Buffer a point feature
 * @param {Object} pointItem - Point feature item
 * @param {number} distance - Buffer distance
 * @param {Object} options - Buffer options
 * @param {number} stepNumber - Step number for logging
 * @returns {Object} Buffer result
 */
const performPointBuffer = (pointItem, distance, options, stepNumber) => {
  console.log(`🔄 Buffer step ${stepNumber}: Buffering point`);
  console.log(`📍 Point details:`, {
    name: pointItem.feature.properties?.name || 'Unnamed Point',
    coordinates: pointItem.feature.geometry.coordinates,
    properties_count: Object.keys(pointItem.feature.properties || {}).length
  });

  try {
    const bufferStartTime = performance.now();
    
    // Create buffer around point
    const bufferedFeature = turf.buffer(pointItem.feature, distance, options);
    
    const bufferEndTime = performance.now();
    const bufferTime = bufferEndTime - bufferStartTime;

    if (bufferedFeature) {
      const bufferedArea = turf.area(bufferedFeature);
      
      console.log(`✅ Point buffer step ${stepNumber} successful`);
      console.log(`📊 Buffered area: ${bufferedArea.toFixed(2)} m²`);
      console.log(`⏱️ Buffer execution time: ${bufferTime.toFixed(2)}ms`);

      // Enhanced feature with buffer metadata
      const enhancedFeature = {
        ...bufferedFeature,
        properties: {
          ...bufferedFeature.properties,
          ...pointItem.feature.properties,
          operation: 'buffer',
          bufferDate: new Date().toISOString(),
          originalGeometry: 'Point',
          bufferDistance: distance,
          bufferUnits: options.units,
          bufferedArea: bufferedArea,
          bufferSteps: options.steps,
          executionTime: bufferTime
        }
      };

      return {
        success: true,
        feature: enhancedFeature,
        metadata: {
          stepNumber,
          featureType: 'point',
          originalGeometry: pointItem.feature.geometry.type,
          bufferedArea,
          bufferDistance: distance,
          bufferUnits: options.units,
          executionTime: bufferTime,
          success: true,
          method: 'turf.buffer'
        }
      };
    } else {
      console.warn(`⚠️ Point buffer step ${stepNumber} returned null`);
      return {
        success: false,
        metadata: {
          stepNumber,
          featureType: 'point',
          success: false,
          reason: 'Buffer returned null'
        }
      };
    }

  } catch (bufferError) {
    console.error(`❌ Point buffer step ${stepNumber} failed:`, bufferError.message);
    return {
      success: false,
      metadata: {
        stepNumber,
        featureType: 'point',
        success: false,
        error: bufferError.message,
        reason: 'Buffer operation failed'
      }
    };
  }
};

/**
 * Buffer a line feature
 * @param {Object} lineItem - Line feature item
 * @param {number} distance - Buffer distance
 * @param {Object} options - Buffer options
 * @param {number} stepNumber - Step number for logging
 * @returns {Object} Buffer result
 */
const performLineBuffer = (lineItem, distance, options, stepNumber) => {
  console.log(`🔄 Buffer step ${stepNumber}: Buffering line`);
  console.log(`📏 Line details:`, {
    name: lineItem.feature.properties?.name || 'Unnamed Line',
    length: `${lineItem.length.toFixed(3)} km`,
    geometry_type: lineItem.feature.geometry.type,
    coordinate_count: lineItem.feature.geometry.coordinates.length
  });

  try {
    const bufferStartTime = performance.now();
    
    // Create buffer around line
    const bufferedFeature = turf.buffer(lineItem.feature, distance, options);
    
    const bufferEndTime = performance.now();
    const bufferTime = bufferEndTime - bufferStartTime;

    if (bufferedFeature) {
      const bufferedArea = turf.area(bufferedFeature);
      
      console.log(`✅ Line buffer step ${stepNumber} successful`);
      console.log(`📏 Original length: ${lineItem.length.toFixed(3)} km`);
      console.log(`📊 Buffered area: ${bufferedArea.toFixed(2)} m²`);
      console.log(`📊 Buffer width: ${distance * 2} ${options.units} (both sides)`);
      console.log(`⏱️ Buffer execution time: ${bufferTime.toFixed(2)}ms`);

      // Enhanced feature with buffer metadata
      const enhancedFeature = {
        ...bufferedFeature,
        properties: {
          ...bufferedFeature.properties,
          ...lineItem.feature.properties,
          operation: 'buffer',
          bufferDate: new Date().toISOString(),
          originalGeometry: lineItem.feature.geometry.type,
          originalLength: lineItem.length,
          bufferDistance: distance,
          bufferUnits: options.units,
          bufferedArea: bufferedArea,
          bufferWidth: distance * 2, // Total width (both sides)
          bufferSteps: options.steps,
          executionTime: bufferTime
        }
      };

      return {
        success: true,
        feature: enhancedFeature,
        metadata: {
          stepNumber,
          featureType: 'line',
          originalGeometry: lineItem.feature.geometry.type,
          originalLength: lineItem.length,
          bufferedArea,
          bufferDistance: distance,
          bufferUnits: options.units,
          bufferWidth: distance * 2,
          executionTime: bufferTime,
          success: true,
          method: 'turf.buffer'
        }
      };
    } else {
      console.warn(`⚠️ Line buffer step ${stepNumber} returned null`);
      return {
        success: false,
        metadata: {
          stepNumber,
          featureType: 'line',
          success: false,
          reason: 'Buffer returned null'
        }
      };
    }

  } catch (bufferError) {
    console.error(`❌ Line buffer step ${stepNumber} failed:`, bufferError.message);
    return {
      success: false,
      metadata: {
        stepNumber,
        featureType: 'line',
        success: false,
        error: bufferError.message,
        reason: 'Buffer operation failed'
      }
    };
  }
};

/**
 * Buffer a polygon feature
 * @param {Object} polygonItem - Polygon feature item
 * @param {number} distance - Buffer distance
 * @param {Object} options - Buffer options
 * @param {number} stepNumber - Step number for logging
 * @returns {Object} Buffer result
 */
const performPolygonBuffer = (polygonItem, distance, options, stepNumber) => {
  console.log(`🔄 Buffer step ${stepNumber}: Buffering polygon`);
  console.log(`📐 Polygon details:`, {
    name: polygonItem.feature.properties?.name || 'Unnamed Polygon',
    area: `${polygonItem.area.toFixed(2)} m²`,
    geometry_type: polygonItem.feature.geometry.type,
    ring_count: polygonItem.feature.geometry.coordinates.length
  });

  try {
    const bufferStartTime = performance.now();
    
    // Create buffer around polygon
    const bufferedFeature = turf.buffer(polygonItem.feature, distance, options);
    
    const bufferEndTime = performance.now();
    const bufferTime = bufferEndTime - bufferStartTime;

    if (bufferedFeature) {
      const bufferedArea = turf.area(bufferedFeature);
      const areaIncrease = bufferedArea - polygonItem.area;
      const areaGrowth = (areaIncrease / polygonItem.area) * 100;
      
      console.log(`✅ Polygon buffer step ${stepNumber} successful`);
      console.log(`📊 Original area: ${polygonItem.area.toFixed(2)} m²`);
      console.log(`📊 Buffered area: ${bufferedArea.toFixed(2)} m²`);
      console.log(`📊 Area increase: ${areaIncrease.toFixed(2)} m²`);
      console.log(`📊 Area growth: ${areaGrowth.toFixed(2)}%`);
      console.log(`⏱️ Buffer execution time: ${bufferTime.toFixed(2)}ms`);

      // Determine buffer direction
      const bufferDirection = distance > 0 ? 'outward' : 'inward';
      console.log(`📍 Buffer direction: ${bufferDirection} (${distance > 0 ? 'expanding' : 'shrinking'})`);

      // Enhanced feature with buffer metadata
      const enhancedFeature = {
        ...bufferedFeature,
        properties: {
          ...bufferedFeature.properties,
          ...polygonItem.feature.properties,
          operation: 'buffer',
          bufferDate: new Date().toISOString(),
          originalGeometry: polygonItem.feature.geometry.type,
          originalArea: polygonItem.area,
          bufferDistance: distance,
          bufferUnits: options.units,
          bufferDirection,
          bufferedArea: bufferedArea,
          areaIncrease: areaIncrease,
          areaGrowth: areaGrowth,
          bufferSteps: options.steps,
          executionTime: bufferTime
        }
      };

      return {
        success: true,
        feature: enhancedFeature,
        metadata: {
          stepNumber,
          featureType: 'polygon',
          originalGeometry: polygonItem.feature.geometry.type,
          originalArea: polygonItem.area,
          bufferedArea,
          areaIncrease,
          areaGrowth,
          bufferDistance: distance,
          bufferUnits: options.units,
          bufferDirection,
          executionTime: bufferTime,
          success: true,
          method: 'turf.buffer'
        }
      };
    } else {
      console.warn(`⚠️ Polygon buffer step ${stepNumber} returned null`);
      return {
        success: false,
        metadata: {
          stepNumber,
          featureType: 'polygon',
          success: false,
          reason: 'Buffer returned null'
        }
      };
    }

  } catch (bufferError) {
    console.error(`❌ Polygon buffer step ${stepNumber} failed:`, bufferError.message);
    return {
      success: false,
      metadata: {
        stepNumber,
        featureType: 'polygon',
        success: false,
        error: bufferError.message,
        reason: 'Buffer operation failed'
      }
    };
  }
};

/**
 * Validate features for buffer operation
 * @param {Array} features - Features to validate
 * @param {number} distance - Buffer distance
 * @param {Object} options - Buffer options
 * @returns {Object} Validation result
 */
export const validateBufferInput = (features, distance, options = {}) => {
  console.log('🔍 Validating buffer input...');
  console.log('📊 Features to validate:', features?.length);
  console.log('📏 Buffer distance:', distance);
  console.log('📊 Buffer options:', options);
  
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    featureCounts: {
      points: 0,
      lines: 0,
      polygons: 0,
      others: 0
    },
    details: []
  };

  if (!features || !Array.isArray(features)) {
    validation.valid = false;
    validation.errors.push('Input must be an array of features');
    console.error('❌ Invalid input type');
    return validation;
  }

  if (features.length === 0) {
    validation.valid = false;
    validation.errors.push('At least one feature is required for buffer');
    console.error('❌ No features provided');
    return validation;
  }

  if (typeof distance !== 'number' || isNaN(distance)) {
    validation.valid = false;
    validation.errors.push(`Distance must be a number, got ${typeof distance}`);
    console.error('❌ Invalid distance');
    return validation;
  }

  if (distance === 0) {
    validation.warnings.push('Buffer distance is 0 - no buffering will occur');
    console.warn('⚠️ Zero buffer distance');
  }

  features.forEach((feature, index) => {
    console.log(`🔍 Validating feature ${index + 1}...`);
    
    const featureDetail = {
      index,
      valid: false,
      warnings: [],
      geometryType: null,
      area: null,
      length: null
    };

    if (!feature || !feature.geometry) {
      validation.warnings.push(`Feature ${index + 1}: Missing geometry`);
      featureDetail.warnings.push('Missing geometry');
      console.warn(`⚠️ Feature ${index + 1}: Missing geometry`);
      validation.featureCounts.others++;
    } else {
      featureDetail.geometryType = feature.geometry.type;
      
      try {
        switch (feature.geometry.type) {
          case 'Point':
          case 'MultiPoint':
            validation.featureCounts.points++;
            featureDetail.valid = true;
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type} - Buffer will create circle`);
            break;
            
          case 'LineString':
          case 'MultiLineString':
            validation.featureCounts.lines++;
            featureDetail.valid = true;
            featureDetail.length = turf.length(feature, {units: 'kilometers'});
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type} - ${featureDetail.length.toFixed(3)} km - Buffer will create corridor`);
            break;
            
          case 'Polygon':
          case 'MultiPolygon':
            validation.featureCounts.polygons++;
            featureDetail.valid = true;
            featureDetail.area = turf.area(feature);
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type} - ${featureDetail.area.toFixed(2)} m² - Buffer will expand/contract area`);
            break;
            
          default:
            validation.featureCounts.others++;
            validation.warnings.push(`Feature ${index + 1}: Unsupported geometry type (${feature.geometry.type})`);
            featureDetail.warnings.push(`Unsupported geometry type (${feature.geometry.type})`);
            console.warn(`⚠️ Feature ${index + 1}: Unsupported geometry type (${feature.geometry.type})`);
        }
        
        if (featureDetail.valid && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
          if (!turf.booleanValid(feature)) {
            validation.warnings.push(`Feature ${index + 1}: Invalid geometry detected`);
            featureDetail.warnings.push('Invalid geometry detected');
            console.warn(`⚠️ Feature ${index + 1}: Invalid geometry detected`);
          } else {
            console.log(`✅ Feature ${index + 1}: Valid geometry`);
          }
        }
        
      } catch (error) {
        validation.warnings.push(`Feature ${index + 1}: Geometry validation failed - ${error.message}`);
        featureDetail.warnings.push(`Validation failed - ${error.message}`);
        console.warn(`⚠️ Feature ${index + 1}: Validation failed -`, error.message);
      }
    }

    validation.details.push(featureDetail);
  });

  // Check buffer configuration
  const { units = 'meters', steps = 8 } = options;
  
  if (typeof steps !== 'number' || steps < 3) {
    validation.warnings.push('Buffer steps should be at least 3 for smooth circles');
    console.warn('⚠️ Low buffer steps may result in rough circles');
  }

  if (!['meters', 'kilometers', 'miles', 'feet'].includes(units)) {
    validation.warnings.push(`Unusual units specified: ${units}`);
    console.warn(`⚠️ Unusual units: ${units}`);
  }

  console.log('📊 Buffer validation result:', {
    valid: validation.valid,
    points: validation.featureCounts.points,
    lines: validation.featureCounts.lines,
    polygons: validation.featureCounts.polygons,
    others: validation.featureCounts.others,
    distance: `${distance} ${units}`,
    steps: steps,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });

  console.log('🎯 Expected buffer results:');
  if (validation.featureCounts.points > 0) {
    console.log(`   📍 ${validation.featureCounts.points} circles around points`);
  }
  if (validation.featureCounts.lines > 0) {
    console.log(`   📏 ${validation.featureCounts.lines} corridors around lines`);
  }
  if (validation.featureCounts.polygons > 0) {
    const direction = distance > 0 ? 'expanded' : 'contracted';
    console.log(`   📐 ${validation.featureCounts.polygons} ${direction} polygons`);
  }

  return validation;
};

export default performBuffer;