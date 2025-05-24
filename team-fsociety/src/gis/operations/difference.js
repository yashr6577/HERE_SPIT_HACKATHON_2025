import * as turf from '@turf/turf';

/**
 * Perform difference operation between features
 * @param {Array} features - Array of features
 * @param {Object} options - Optional parameters
 * @returns {Object} Difference result with remaining geometry and metadata
 */
export function performDifference(features, options = {}) {
  console.log('🔄 Starting difference operation...');
  console.log('📊 Function called with arguments count:', arguments.length);
  console.log('📊 First argument (features):', features);
  console.log('📊 Features type:', typeof features);
  console.log('📊 Features is array:', Array.isArray(features));
  console.log('📊 Features length:', features?.length);
  console.log('📊 Second argument (options):', options);
  
  // Stack trace to identify caller
  console.log('📍 Function call stack:');
  console.trace();
  
  // Early validation checks
  if (features === undefined) {
    console.error('❌ CRITICAL: features parameter is undefined!');
    return {
      success: false,
      error: 'Features parameter is undefined. Function called without proper arguments.',
      operation: 'difference'
    };
  }
  
  if (features === null) {
    console.error('❌ CRITICAL: features parameter is null!');
    return {
      success: false,
      error: 'Features parameter is null.',
      operation: 'difference'
    };
  }
  
  if (!Array.isArray(features)) {
    console.error('❌ CRITICAL: features is not an array!');
    console.error('📊 Actual type:', typeof features);
    console.error('📊 Actual value:', features);
    return {
      success: false,
      error: `Features must be an array, got ${typeof features}`,
      operation: 'difference'
    };
  }
  
  if (features.length < 2) {
    console.error('❌ CRITICAL: Insufficient features for difference operation!');
    console.error('📊 Features provided:', features.length);
    return {
      success: false,
      error: `Difference requires at least 2 features. Got: ${features.length} features`,
      operation: 'difference'
    };
  }

  console.log('📊 Input features:', features.length);
  
  // Log each feature details
  features.forEach((feature, index) => {
    try {
      console.log(`📊 Input Feature ${index + 1}:`, {
        exists: !!feature,
        hasGeometry: !!(feature && feature.geometry),
        type: feature?.geometry?.type || 'Unknown',
        properties: feature?.properties?.name || `Feature ${index + 1}`,
        coordinates_length: feature?.geometry?.coordinates?.length || 'N/A',
        area: feature?.geometry?.type === 'Polygon' || feature?.geometry?.type === 'MultiPolygon' ? 
              `${turf.area(feature).toFixed(2)} m²` : 'N/A',
        length: feature?.geometry?.type === 'LineString' || feature?.geometry?.type === 'MultiLineString' ? 
                `${turf.length(feature, {units: 'kilometers'}).toFixed(3)} km` : 'N/A'
      });
    } catch (featureError) {
      console.error(`❌ Error analyzing feature ${index + 1}:`, featureError.message);
    }
  });

  try {
    // Analyze feature types
    console.log('🔍 Analyzing feature types...');
    const featureTypes = {
      polygons: [],
      lines: [],
      points: [],
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
        case 'Polygon':
        case 'MultiPolygon':
          featureTypes.polygons.push({feature, index, area: turf.area(feature)});
          break;
        case 'LineString':
        case 'MultiLineString':
          featureTypes.lines.push({feature, index, length: turf.length(feature, {units: 'kilometers'})});
          break;
        case 'Point':
        case 'MultiPoint':
          featureTypes.points.push({feature, index});
          break;
        default:
          featureTypes.others.push({feature, index, type: geometryType});
          console.warn(`⚠️ Feature ${index + 1}: Unsupported geometry type: ${geometryType}`);
      }
    });

    console.log('📊 Feature type analysis:', {
      polygons: featureTypes.polygons.length,
      lines: featureTypes.lines.length,
      points: featureTypes.points.length,
      others: featureTypes.others.length
    });

    // Determine operation type and assign primary/subtract features
    let operationType = 'unknown';
    let primaryFeatures = [];
    let subtractFeatures = [];

    if (featureTypes.polygons.length >= 2) {
      operationType = 'polygon-polygon';
      primaryFeatures = [featureTypes.polygons[0]];
      subtractFeatures = featureTypes.polygons.slice(1);
      console.log('⚡ Performing Polygon-Polygon difference...');
    } else if (featureTypes.polygons.length === 1 && featureTypes.points.length > 0) {
      operationType = 'point-polygon';
      primaryFeatures = featureTypes.points;
      subtractFeatures = featureTypes.polygons;
      console.log('⚡ Performing Point-Polygon difference (points outside polygon)...');
    } else if (featureTypes.polygons.length === 1 && featureTypes.lines.length > 0) {
      operationType = 'line-polygon';
      primaryFeatures = featureTypes.lines;
      subtractFeatures = featureTypes.polygons;
      console.log('⚡ Performing Line-Polygon difference (lines outside polygon)...');
    } else {
      const error = `Unsupported feature combination: ${featureTypes.polygons.length} polygons, ${featureTypes.lines.length} lines, ${featureTypes.points.length} points`;
      console.error('❌', error);
      throw new Error(error);
    }

    console.log('📊 Operation details:', {
      type: operationType,
      primary_features: primaryFeatures.length,
      subtract_features: subtractFeatures.length
    });

    // Execute the appropriate difference operation
    let result;
    const operationStartTime = performance.now();

    switch (operationType) {
      case 'polygon-polygon':
        result = performPolygonPolygonDifference(primaryFeatures, subtractFeatures, options);
        break;
      case 'point-polygon':
        result = performPointPolygonDifference(primaryFeatures, subtractFeatures, options);
        break;
      case 'line-polygon':
        result = performLinePolygonDifference(primaryFeatures, subtractFeatures, options);
        break;
      default:
        throw new Error(`Unsupported difference operation: ${operationType}`);
    }

    const operationEndTime = performance.now();
    const totalExecutionTime = operationEndTime - operationStartTime;

    if (result && result.success) {
      console.log('✅ Difference operation completed successfully!');
      console.log(`⏱️ Total execution time: ${totalExecutionTime.toFixed(2)}ms`);
      console.log('📤 Final result summary:', {
        success: true,
        operation_type: operationType,
        input_features: features.length,
        output_features: result.result.features.length,
        features_removed: primaryFeatures.length - result.result.features.length,
        features_retained: result.result.features.length,
        execution_time: `${totalExecutionTime.toFixed(2)}ms`
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          operation: 'difference',
          operationType,
          inputFeatures: features.length,
          outputFeatures: result.result.features.length,
          featuresRemoved: primaryFeatures.length - result.result.features.length,
          featuresRetained: result.result.features.length,
          totalExecutionTime
        }
      };
    } else {
      console.error('❌ Difference operation failed:', result?.error || 'Unknown error');
      return result || {
        success: false,
        error: 'Unknown error in difference operation',
        operation: 'difference'
      };
    }

  } catch (error) {
    console.error('❌ Difference operation failed with exception:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      input_features: features?.length || 0,
      feature_types: features?.map(f => f?.geometry?.type) || []
    });

    return {
      success: false,
      error: `Difference operation failed: ${error.message}`,
      operation: 'difference',
      debug: {
        errorType: error.constructor.name,
        errorMessage: error.message,
        inputFeatureCount: features?.length || 0
      }
    };
  }
};

/**
 * Perform Polygon-Polygon difference
 * @param {Array} primaryFeatures - Polygons to subtract from
 * @param {Array} subtractFeatures - Polygons to subtract
 * @param {Object} options - Options
 * @returns {Object} Difference result
 */
const performPolygonPolygonDifference = (primaryFeatures, subtractFeatures, options = {}) => {
  console.log('🔄 Starting Polygon-Polygon difference...');
  console.log('📊 Primary polygon:', {
    area: `${primaryFeatures[0].area.toFixed(2)} m²`,
    name: primaryFeatures[0].feature.properties?.name || 'Unnamed'
  });

  const resultFeatures = [];
  const differenceSteps = [];

  primaryFeatures.forEach((primaryItem, primaryIndex) => {
    console.log(`⚡ Processing primary polygon ${primaryIndex + 1}...`);
    
    let currentPolygon = primaryItem.feature;
    let remainingArea = primaryItem.area;
    let stepCount = 0;

    subtractFeatures.forEach((subtractItem, subtractIndex) => {
      stepCount++;
      console.log(`🔄 Difference step ${stepCount}: Subtracting polygon ${subtractIndex + 1}`);
      console.log(`📊 Subtract polygon details:`, {
        area: `${subtractItem.area.toFixed(2)} m²`,
        name: subtractItem.feature.properties?.name || 'Unnamed'
      });

      try {
        const stepStartTime = performance.now();
        
        // Check spatial relationships
        const intersects = turf.booleanIntersects(currentPolygon, subtractItem.feature);
        const overlaps = turf.booleanOverlap(currentPolygon, subtractItem.feature);
        const contains = turf.booleanContains(currentPolygon, subtractItem.feature);
        const within = turf.booleanWithin(currentPolygon, subtractItem.feature);

        console.log(`🔍 Spatial relationship:`, { intersects, overlaps, contains, within });

        if (within) {
          console.log(`🚫 Primary polygon is completely within subtract polygon - removing entirely`);
          currentPolygon = null;
          remainingArea = 0;
        } else if (intersects || overlaps || contains) {
          console.log(`✂️ Polygons intersect - performing difference operation`);
          
          const differenceResult = turf.difference(currentPolygon, subtractItem.feature);
          const stepEndTime = performance.now();
          const stepTime = stepEndTime - stepStartTime;

          if (differenceResult) {
            const newArea = turf.area(differenceResult);
            const removedArea = remainingArea - newArea;
            
            console.log(`✅ Difference step ${stepCount} successful`);
            console.log(`📊 Area before: ${remainingArea.toFixed(2)} m²`);
            console.log(`📊 Area after: ${newArea.toFixed(2)} m²`);
            console.log(`📊 Area removed: ${removedArea.toFixed(2)} m²`);
            console.log(`⏱️ Step execution time: ${stepTime.toFixed(2)}ms`);

            currentPolygon = differenceResult;
            remainingArea = newArea;

            differenceSteps.push({
              step: stepCount,
              subtractIndex: subtractIndex + 1,
              intersects, overlaps, contains, within,
              executionTime: stepTime,
              areaBefore: remainingArea + removedArea,
              areaAfter: newArea,
              areaRemoved: removedArea,
              success: true,
              method: 'turf.difference'
            });
          } else {
            console.warn(`⚠️ Difference step ${stepCount} returned null - keeping original`);
            differenceSteps.push({
              step: stepCount,
              subtractIndex: subtractIndex + 1,
              intersects, overlaps, contains, within,
              success: false,
              reason: 'Difference returned null'
            });
          }
        } else {
          console.log(`📦 Polygons are separate - no change needed`);
          differenceSteps.push({
            step: stepCount,
            subtractIndex: subtractIndex + 1,
            intersects: false, overlaps: false, contains: false, within: false,
            success: true,
            method: 'no-operation',
            reason: 'No spatial intersection'
          });
        }

        if (!currentPolygon) {
          console.log(`🚫 Primary polygon completely removed, stopping further operations`);
          //break;
        }

      } catch (stepError) {
        console.error(`❌ Difference step ${stepCount} failed:`, stepError.message);
        differenceSteps.push({
          step: stepCount,
          subtractIndex: subtractIndex + 1,
          success: false,
          error: stepError.message,
          reason: 'Difference operation failed'
        });
      }
    });

    // Add remaining polygon to results if it exists
    if (currentPolygon) {
      const finalFeature = {
        ...currentPolygon,
        properties: {
          ...currentPolygon.properties,
          operation: 'difference',
          differenceDate: new Date().toISOString(),
          originalArea: primaryItem.area,
          finalArea: remainingArea,
          areaReduction: primaryItem.area - remainingArea,
          areaRetained: (remainingArea / primaryItem.area) * 100,
          differenceSteps: differenceSteps.length
        }
      };

      resultFeatures.push(finalFeature);
      
      console.log(`✅ Primary polygon ${primaryIndex + 1} processed:`, {
        original_area: `${primaryItem.area.toFixed(2)} m²`,
        final_area: `${remainingArea.toFixed(2)} m²`,
        area_reduction: `${(primaryItem.area - remainingArea).toFixed(2)} m²`,
        retention_percentage: `${((remainingArea / primaryItem.area) * 100).toFixed(2)}%`
      });
    } else {
      console.log(`🚫 Primary polygon ${primaryIndex + 1} completely removed`);
    }
  });

  const totalOriginalArea = primaryFeatures.reduce((sum, item) => sum + item.area, 0);
  const totalFinalArea = resultFeatures.reduce((sum, feature) => sum + turf.area(feature), 0);
  const totalRemovedArea = totalOriginalArea - totalFinalArea;

  console.log('📊 Polygon-Polygon difference summary:', {
    original_polygons: primaryFeatures.length,
    final_polygons: resultFeatures.length,
    total_original_area: `${totalOriginalArea.toFixed(2)} m²`,
    total_final_area: `${totalFinalArea.toFixed(2)} m²`,
    total_removed_area: `${totalRemovedArea.toFixed(2)} m²`,
    area_retention: `${((totalFinalArea / totalOriginalArea) * 100).toFixed(2)}%`,
    successful_steps: differenceSteps.filter(step => step.success).length,
    total_steps: differenceSteps.length
  });

  return {
    success: true,
    result: {
      type: 'FeatureCollection',
      features: resultFeatures
    },
    metadata: {
      operationType: 'polygon-polygon',
      totalOriginalArea,
      totalFinalArea,
      totalRemovedArea,
      areaRetention: (totalFinalArea / totalOriginalArea) * 100,
      differenceSteps,
      successfulSteps: differenceSteps.filter(step => step.success).length
    }
  };
};

/**
 * Perform Point-Polygon difference (points outside polygon)
 * @param {Array} primaryFeatures - Points to filter
 * @param {Array} subtractFeatures - Polygons to subtract from
 * @param {Object} options - Options
 * @returns {Object} Difference result
 */
const performPointPolygonDifference = (primaryFeatures, subtractFeatures, options = {}) => {
  console.log('🔄 Starting Point-Polygon difference...');
  console.log('📊 Processing points outside polygon boundaries...');

  const resultFeatures = [];
  const pointAnalysis = [];

  primaryFeatures.forEach((pointItem, pointIndex) => {
    console.log(`🔍 Analyzing point ${pointIndex + 1}: ${pointItem.feature.properties?.name || 'Unnamed'}`);
    
    let isOutside = true;
    const containmentChecks = [];

    subtractFeatures.forEach((polygonItem, polygonIndex) => {
      console.log(`🔄 Checking point ${pointIndex + 1} against polygon ${polygonIndex + 1}`);
      
      try {
        const isWithin = turf.booleanWithin(pointItem.feature, polygonItem.feature);
        const isOnBoundary = turf.booleanPointOnLine(pointItem.feature, turf.polygonToLine(polygonItem.feature));
        
        console.log(`🔍 Point ${pointIndex + 1} vs Polygon ${polygonIndex + 1}:`, { 
          within: isWithin, 
          on_boundary: isOnBoundary 
        });

        containmentChecks.push({
          polygonIndex: polygonIndex + 1,
          polygonName: polygonItem.feature.properties?.name || 'Unnamed',
          within: isWithin,
          onBoundary: isOnBoundary
        });

        if (isWithin || isOnBoundary) {
          isOutside = false;
          console.log(`🚫 Point ${pointIndex + 1} is INSIDE ${polygonItem.feature.properties?.name || `polygon ${polygonIndex + 1}`} - EXCLUDED from result`);
        }

      } catch (checkError) {
        console.error(`❌ Containment check failed for point ${pointIndex + 1} vs polygon ${polygonIndex + 1}:`, checkError.message);
        containmentChecks.push({
          polygonIndex: polygonIndex + 1,
          error: checkError.message,
          within: false,
          onBoundary: false
        });
      }
    });

    pointAnalysis.push({
      pointIndex: pointIndex + 1,
      pointName: pointItem.feature.properties?.name || 'Unnamed',
      coordinates: pointItem.feature.geometry.coordinates,
      isOutside,
      containmentChecks
    });

    if (isOutside) {
      console.log(`✅ Point ${pointIndex + 1} is OUTSIDE all polygons - INCLUDED in result`);
      
      const enhancedFeature = {
        ...pointItem.feature,
        properties: {
          ...pointItem.feature.properties,
          operation: 'difference',
          differenceDate: new Date().toISOString(),
          status: 'outside_polygon',
          checked_against_polygons: subtractFeatures.length,
          containment_checks: containmentChecks
        }
      };

      resultFeatures.push(enhancedFeature);
    } else {
      console.log(`🚫 Point ${pointIndex + 1} is INSIDE polygon(s) - EXCLUDED from result`);
    }
  });

  console.log('📊 Point-Polygon difference summary:', {
    total_points: primaryFeatures.length,
    points_outside: resultFeatures.length,
    points_inside: primaryFeatures.length - resultFeatures.length,
    retention_rate: `${((resultFeatures.length / primaryFeatures.length) * 100).toFixed(2)}%`,
    exclusion_rate: `${(((primaryFeatures.length - resultFeatures.length) / primaryFeatures.length) * 100).toFixed(2)}%`
  });

  return {
    success: true,
    result: {
      type: 'FeatureCollection',
      features: resultFeatures
    },
    metadata: {
      operationType: 'point-polygon',
      totalPoints: primaryFeatures.length,
      pointsOutside: resultFeatures.length,
      pointsInside: primaryFeatures.length - resultFeatures.length,
      retentionRate: (resultFeatures.length / primaryFeatures.length) * 100,
      exclusionRate: ((primaryFeatures.length - resultFeatures.length) / primaryFeatures.length) * 100,
      pointAnalysis
    }
  };
};

/**
 * Perform Line-Polygon difference (lines outside polygon)
 * @param {Array} primaryFeatures - Lines to filter
 * @param {Array} subtractFeatures - Polygons to subtract from
 * @param {Object} options - Options
 * @returns {Object} Difference result
 */
const performLinePolygonDifference = (primaryFeatures, subtractFeatures, options = {}) => {
  console.log('🔄 Starting Line-Polygon difference...');
  console.log('📊 Processing line segments outside polygon boundaries...');

  const resultFeatures = [];
  const lineAnalysis = [];

  primaryFeatures.forEach((lineItem, lineIndex) => {
    console.log(`🔍 Analyzing line ${lineIndex + 1}: ${lineItem.feature.properties?.name || 'Unnamed'}`);
    console.log(`📏 Line length: ${lineItem.length.toFixed(3)} km`);
    
    let currentLine = lineItem.feature;
    let remainingLength = lineItem.length;

    subtractFeatures.forEach((polygonItem, polygonIndex) => {
      console.log(`🔄 Processing line ${lineIndex + 1} against polygon ${polygonIndex + 1}`);
      
      try {
        const intersects = turf.booleanIntersects(currentLine, polygonItem.feature);
        const within = turf.booleanWithin(currentLine, polygonItem.feature);

        console.log(`🔍 Line ${lineIndex + 1} vs Polygon ${polygonIndex + 1}:`, { 
          intersects, 
          within 
        });

        if (within) {
          console.log(`🚫 Line ${lineIndex + 1} is completely within polygon - removing entirely`);
          currentLine = null;
          remainingLength = 0;
        } else if (intersects) {
          console.log(`✂️ Line ${lineIndex + 1} intersects polygon - calculating segments outside`);
          // For now, if it intersects, we'll keep the original line
          // In a more sophisticated implementation, you'd clip the line segments
          console.log(`📦 Keeping line as-is (intersection handling can be enhanced)`);
        } else {
          console.log(`📦 Line ${lineIndex + 1} is separate from polygon - no change`);
        }

        if (!currentLine) {
          console.log(`🚫 Line ${lineIndex + 1} completely removed`);
          //break;
        }

      } catch (analysisError) {
        console.error(`❌ Line-polygon analysis failed:`, analysisError.message);
      }
    });

    lineAnalysis.push({
      lineIndex: lineIndex + 1,
      lineName: lineItem.feature.properties?.name || 'Unnamed',
      originalLength: lineItem.length,
      finalLength: remainingLength,
      lengthRetained: remainingLength > 0 ? (remainingLength / lineItem.length) * 100 : 0,
      fullyRemoved: !currentLine
    });

    if (currentLine && remainingLength > 0) {
      console.log(`✅ Line ${lineIndex + 1} retained:`, {
        original_length: `${lineItem.length.toFixed(3)} km`,
        final_length: `${remainingLength.toFixed(3)} km`,
        retention: `${((remainingLength / lineItem.length) * 100).toFixed(2)}%`
      });

      const enhancedFeature = {
        ...currentLine,
        properties: {
          ...currentLine.properties,
          operation: 'difference',
          differenceDate: new Date().toISOString(),
          originalLength: lineItem.length,
          finalLength: remainingLength,
          lengthRetained: (remainingLength / lineItem.length) * 100,
          status: 'outside_polygon'
        }
      };

      resultFeatures.push(enhancedFeature);
    } else {
      console.log(`🚫 Line ${lineIndex + 1} completely removed or inside polygon`);
    }
  });

  const totalOriginalLength = primaryFeatures.reduce((sum, item) => sum + item.length, 0);
  const totalFinalLength = lineAnalysis.reduce((sum, analysis) => sum + analysis.finalLength, 0);

  console.log('📊 Line-Polygon difference summary:', {
    total_lines: primaryFeatures.length,
    lines_retained: resultFeatures.length,
    lines_removed: primaryFeatures.length - resultFeatures.length,
    total_original_length: `${totalOriginalLength.toFixed(3)} km`,
    total_final_length: `${totalFinalLength.toFixed(3)} km`,
    length_retention: `${((totalFinalLength / totalOriginalLength) * 100).toFixed(2)}%`
  });

  return {
    success: true,
    result: {
      type: 'FeatureCollection',
      features: resultFeatures
    },
    metadata: {
      operationType: 'line-polygon',
      totalLines: primaryFeatures.length,
      linesRetained: resultFeatures.length,
      linesRemoved: primaryFeatures.length - resultFeatures.length,
      totalOriginalLength,
      totalFinalLength,
      lengthRetention: (totalFinalLength / totalOriginalLength) * 100,
      lineAnalysis
    }
  };
};

/**
 * Validate features for difference operation
 * @param {Array} features - Features to validate
 * @returns {Object} Validation result
 */
export const validateDifferenceInput = (features) => {
  console.log('🔍 Validating difference input...');
  console.log('📊 Features to validate:', features?.length);
  
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    featureCounts: {
      polygons: 0,
      lines: 0,
      points: 0,
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

  if (features.length < 2) {
    validation.valid = false;
    validation.errors.push('At least two features are required for difference');
    console.error('❌ Insufficient features');
    return validation;
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
          case 'Polygon':
          case 'MultiPolygon':
            validation.featureCounts.polygons++;
            featureDetail.valid = true;
            featureDetail.area = turf.area(feature);
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type}, ${featureDetail.area.toFixed(2)} m²`);
            break;
            
          case 'LineString':
          case 'MultiLineString':
            validation.featureCounts.lines++;
            featureDetail.valid = true;
            featureDetail.length = turf.length(feature, {units: 'kilometers'});
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type}, ${featureDetail.length.toFixed(3)} km`);
            break;
            
          case 'Point':
          case 'MultiPoint':
            validation.featureCounts.points++;
            featureDetail.valid = true;
            console.log(`📊 Feature ${index + 1}: ${feature.geometry.type}`);
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

  // Check if we have valid combinations for difference operations
  const { polygons, lines, points } = validation.featureCounts;
  
  if (polygons >= 2) {
    console.log('✅ Valid for Polygon-Polygon difference');
  } else if (polygons === 1 && (points > 0 || lines > 0)) {
    console.log('✅ Valid for Point/Line-Polygon difference');
  } else {
    validation.valid = false;
    validation.errors.push('Invalid feature combination for difference operation');
    console.error('❌ No valid feature combinations found');
  }

  console.log('📊 Validation result:', {
    valid: validation.valid,
    polygons: validation.featureCounts.polygons,
    lines: validation.featureCounts.lines,
    points: validation.featureCounts.points,
    others: validation.featureCounts.others,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });

  return validation;
};