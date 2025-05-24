import * as turf from '@turf/turf';

/**
 * Perform union operation between multiple polygons
 * @param {Array} features - Array of polygon features
 * @param {Object} options - Optional parameters
 * @returns {Object} Union result with merged geometry and metadata
 */
export const performUnion = (features, options = {}) => {
  console.log('🔄 Starting union operation...');
  console.log('📊 Input features:', features.length);
  
  features.forEach((feature, index) => {
    console.log(`📊 Input Feature ${index + 1}:`, {
      type: feature?.geometry?.type,
      properties: feature?.properties?.name || `Feature ${index + 1}`,
      coordinates_length: feature?.geometry?.coordinates?.length,
      area: feature?.geometry?.type === 'Polygon' ? `${turf.area(feature).toFixed(2)} m²` : 'N/A'
    });
  });

  try {
    if (!features || !Array.isArray(features) || features.length < 1) {
      const error = 'Union requires at least 1 feature';
      console.error('❌ Union failed:', error);
      throw new Error(error);
    }

    if (features.length === 1) {
      console.log('ℹ️ Single feature provided - returning as-is');
      const singleFeature = features[0];
      const area = turf.area(singleFeature);
      
      return {
        success: true,
        result: {
          type: 'FeatureCollection',
          features: [{
            ...singleFeature,
            properties: {
              ...singleFeature.properties,
              operation: 'union',
              unionDate: new Date().toISOString(),
              inputFeatureCount: 1,
              totalArea: area
            }
          }]
        },
        metadata: {
          operation: 'union',
          inputFeatures: 1,
          outputFeatures: 1,
          totalArea: area,
          bounds: turf.bbox(singleFeature),
          centroid: turf.centroid(singleFeature).geometry.coordinates,
          executionTime: Date.now()
        }
      };
    }

    // Filter and validate polygon features
    console.log('🔍 Filtering polygon features...');
    const polygonFeatures = features.filter(feature => {
      if (!feature || !feature.geometry) {
        console.warn('⚠️ Skipping feature with missing geometry');
        return false;
      }
      
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
        console.warn(`⚠️ Skipping non-polygon feature: ${feature.geometry.type}`);
        return false;
      }
      
      return true;
    });

    console.log('📊 Valid polygon features after filtering:', polygonFeatures.length);

    if (polygonFeatures.length < 1) {
      const error = 'No valid polygon features found for union';
      console.error('❌', error);
      throw new Error(error);
    }

    // Validate geometries and attempt repair if needed
    console.log('🔍 Validating and repairing geometries...');
    const validatedFeatures = [];
    
    for (let i = 0; i < polygonFeatures.length; i++) {
      const feature = polygonFeatures[i];
      console.log(`🔍 Validating feature ${i + 1}/${polygonFeatures.length}...`);
      
      try {
        const isValid = turf.booleanValid(feature);
        console.log(`📊 Feature ${i + 1} validity:`, isValid);
        
        if (!isValid) {
          console.warn(`⚠️ Feature ${i + 1}: Invalid geometry detected, attempting repair`);
          try {
            const repairedFeature = turf.cleanCoords(feature);
            const repairedValid = turf.booleanValid(repairedFeature);
            console.log(`🔧 Feature ${i + 1} repair result:`, repairedValid ? 'SUCCESS' : 'FAILED');
            
            if (repairedValid) {
              validatedFeatures.push(repairedFeature);
            } else {
              console.error(`❌ Feature ${i + 1}: Could not repair geometry, skipping`);
            }
          } catch (repairError) {
            console.error(`❌ Feature ${i + 1}: Repair failed -`, repairError.message);
          }
        } else {
          console.log(`✅ Feature ${i + 1}: Valid geometry`);
          validatedFeatures.push(feature);
        }
      } catch (validationError) {
        console.error(`❌ Feature ${i + 1}: Validation failed -`, validationError.message);
      }
    }

    console.log('📊 Features after validation:', validatedFeatures.length);

    if (validatedFeatures.length === 0) {
      const error = 'No valid features remaining after validation';
      console.error('❌', error);
      throw new Error(error);
    }

    if (validatedFeatures.length === 1) {
      console.log('ℹ️ Only one valid feature after validation - returning as-is');
      const singleFeature = validatedFeatures[0];
      const area = turf.area(singleFeature);
      
      return {
        success: true,
        result: {
          type: 'FeatureCollection',
          features: [{
            ...singleFeature,
            properties: {
              ...singleFeature.properties,
              operation: 'union',
              unionDate: new Date().toISOString(),
              inputFeatureCount: features.length,
              validFeatureCount: 1,
              totalArea: area
            }
          }]
        },
        metadata: {
          operation: 'union',
          inputFeatures: features.length,
          outputFeatures: 1,
          validatedFeatures: 1,
          totalArea: area,
          bounds: turf.bbox(singleFeature),
          centroid: turf.centroid(singleFeature).geometry.coordinates,
          executionTime: Date.now()
        }
      };
    }

    // Perform iterative union
    console.log('⚡ Starting iterative union process...');
    console.log(`📊 Will process ${validatedFeatures.length} features sequentially`);
    
    let result = validatedFeatures[0];
    console.log('📊 Starting with feature 1:', {
      area: `${turf.area(result).toFixed(2)} m²`,
      type: result.geometry.type
    });

    const unionSteps = [];
    
    for (let i = 1; i < validatedFeatures.length; i++) {
      const currentFeature = validatedFeatures[i];
      console.log(`⚡ Union step ${i}/${validatedFeatures.length - 1}: Merging with feature ${i + 1}`);
      console.log(`📊 Feature ${i + 1} details:`, {
        area: `${turf.area(currentFeature).toFixed(2)} m²`,
        type: currentFeature.geometry.type
      });
      
      try {
        // Check if features intersect or touch before union
        const intersects = turf.booleanIntersects(result, currentFeature);
        const touches = turf.booleanTouches(result, currentFeature);
        console.log(`🔍 Spatial relationship:`, { intersects, touches });
        
        const stepStartTime = performance.now();
        let unionResult = null;
        
        // Handle different spatial relationships
        if (intersects || touches) {
          console.log(`🔗 Features overlap/touch - using turf.union()`);
          
          // Special handling for MultiPolygon unions
          if (result.geometry.type === 'MultiPolygon') {
            console.log(`🔄 Handling MultiPolygon-Polygon union...`);
            
            try {
              // Convert MultiPolygon to individual polygons, union each with currentFeature, then recombine
              const multiPolygonCoords = result.geometry.coordinates;
              console.log(`📊 MultiPolygon has ${multiPolygonCoords.length} polygons`);
              
              let combinedResult = currentFeature;
              let hasSuccessfulUnion = false;
              
              for (let k = 0; k < multiPolygonCoords.length; k++) {
                const individualPolygon = {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Polygon',
                    coordinates: multiPolygonCoords[k]
                  }
                };
                
                const polyIntersects = turf.booleanIntersects(individualPolygon, currentFeature);
                const polyTouches = turf.booleanTouches(individualPolygon, currentFeature);
                
                if (polyIntersects || polyTouches) {
                  console.log(`🔗 MultiPolygon part ${k} intersects with current feature`);
                  try {
                    const partialUnion = turf.union(individualPolygon, combinedResult);
                    if (partialUnion) {
                      combinedResult = partialUnion;
                      hasSuccessfulUnion = true;
                      console.log(`✅ Successfully merged MultiPolygon part ${k}`);
                    }
                  } catch (partialError) {
                    console.warn(`⚠️ Failed to union MultiPolygon part ${k}:`, partialError.message);
                  }
                } else {
                  console.log(`📦 MultiPolygon part ${k} is separate from current feature`);
                }
              }
              
              if (hasSuccessfulUnion) {
                // Create new MultiPolygon with merged results and remaining separate parts
                const remainingSeparateParts = [];
                
                for (let k = 0; k < multiPolygonCoords.length; k++) {
                  const individualPolygon = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: multiPolygonCoords[k]
                    }
                  };
                  
                  const polyIntersects = turf.booleanIntersects(individualPolygon, currentFeature);
                  const polyTouches = turf.booleanTouches(individualPolygon, currentFeature);
                  
                  if (!polyIntersects && !polyTouches) {
                    remainingSeparateParts.push(multiPolygonCoords[k]);
                  }
                }
                
                // Combine the union result with remaining separate parts
                if (combinedResult.geometry.type === 'Polygon') {
                  const allCoords = [combinedResult.geometry.coordinates, ...remainingSeparateParts];
                  unionResult = {
                    type: 'Feature',
                    properties: {
                      ...result.properties,
                      ...currentFeature.properties
                    },
                    geometry: {
                      type: 'MultiPolygon',
                      coordinates: allCoords
                    }
                  };
                } else if (combinedResult.geometry.type === 'MultiPolygon') {
                  const allCoords = [...combinedResult.geometry.coordinates, ...remainingSeparateParts];
                  unionResult = {
                    type: 'Feature',
                    properties: {
                      ...result.properties,
                      ...currentFeature.properties
                    },
                    geometry: {
                      type: 'MultiPolygon',
                      coordinates: allCoords
                    }
                  };
                }
                
                console.log(`🔄 Created enhanced MultiPolygon with ${unionResult.geometry.coordinates.length} parts`);
              } else {
                // No intersections found, just add as separate polygon
                console.log(`📦 No intersections found, adding as separate polygon`);
                const allCoords = [...multiPolygonCoords, currentFeature.geometry.coordinates];
                unionResult = {
                  type: 'Feature',
                  properties: {
                    ...result.properties,
                    ...currentFeature.properties
                  },
                  geometry: {
                    type: 'MultiPolygon',
                    coordinates: allCoords
                  }
                };
                console.log(`🔄 Extended MultiPolygon to ${unionResult.geometry.coordinates.length} parts`);
              }
              
            } catch (multiError) {
              console.error(`❌ MultiPolygon union failed:`, multiError.message);
              // Fallback: just add as separate polygon
              const allCoords = [...result.geometry.coordinates, currentFeature.geometry.coordinates];
              unionResult = {
                type: 'Feature',
                properties: {
                  ...result.properties,
                  ...currentFeature.properties
                },
                geometry: {
                  type: 'MultiPolygon',
                  coordinates: allCoords
                }
              };
            }
            
          } else {
            // Standard Polygon-Polygon union
            console.log(`🔗 Standard Polygon-Polygon union`);
            unionResult = turf.union(result, currentFeature);
          }
          
        } else {
          console.log(`📦 Features are separate - creating combined geometry`);
          
          // For separate polygons, create a MultiPolygon or add to existing one
          if (result.geometry.type === 'Polygon' && currentFeature.geometry.type === 'Polygon') {
            // Create MultiPolygon for separate polygons
            unionResult = {
              type: 'Feature',
              properties: {
                ...result.properties,
                ...currentFeature.properties,
                combinedPolygons: true
              },
              geometry: {
                type: 'MultiPolygon',
                coordinates: [
                  result.geometry.coordinates,
                  currentFeature.geometry.coordinates
                ]
              }
            };
            console.log(`🔄 Created MultiPolygon with ${unionResult.geometry.coordinates.length} polygons`);
          } else if (result.geometry.type === 'MultiPolygon') {
            // Add to existing MultiPolygon
            unionResult = {
              ...result,
              properties: {
                ...result.properties,
                ...currentFeature.properties
              },
              geometry: {
                type: 'MultiPolygon',
                coordinates: [
                  ...result.geometry.coordinates,
                  currentFeature.geometry.coordinates
                ]
              }
            };
            console.log(`🔄 Added to MultiPolygon, now has ${unionResult.geometry.coordinates.length} polygons`);
          } else {
            console.warn(`⚠️ Unsupported geometry combination for separate features`);
            unionResult = result; // Keep previous result
          }
        }
        
        const stepEndTime = performance.now();
        const stepTime = stepEndTime - stepStartTime;
        
        console.log(`⏱️ Union step ${i} execution time:`, `${stepTime.toFixed(2)}ms`);
        
        if (unionResult) {
          const newArea = turf.area(unionResult);
          console.log(`✅ Union step ${i} successful`);
          console.log(`📊 Result area: ${newArea.toFixed(2)} m²`);
          console.log(`📊 Area change: ${(newArea - turf.area(result)).toFixed(2)} m²`);
          console.log(`📊 Result geometry type: ${unionResult.geometry.type}`);
          
          result = unionResult;
          
          unionSteps.push({
            step: i,
            featureIndex: i + 1,
            intersects,
            touches,
            executionTime: stepTime,
            resultArea: newArea,
            success: true,
            method: intersects || touches ? 'union' : 'combine'
          });
        } else {
          console.warn(`⚠️ Union step ${i} returned null - keeping previous result`);
          unionSteps.push({
            step: i,
            featureIndex: i + 1,
            intersects,
            touches,
            executionTime: stepTime,
            success: false,
            reason: 'Union returned null'
          });
        }
        
      } catch (unionError) {
        console.error(`❌ Union step ${i} failed:`, unionError.message);
        console.warn(`⚠️ Continuing with previous result`);
        
        unionSteps.push({
          step: i,
          featureIndex: i + 1,
          success: false,
          error: unionError.message,
          reason: 'Union operation failed'
        });
        
        // Continue with the previous result
      }
    }

    // Calculate final metadata
    console.log('📊 Calculating final metadata...');
    const finalArea = turf.area(result);
    const bounds = turf.bbox(result);
    const centroid = turf.centroid(result);

    console.log('📏 Final calculations:', {
      total_area: `${finalArea.toFixed(2)} m²`,
      bounds,
      centroid: centroid.geometry.coordinates
    });

    // Calculate total input area for comparison
    const totalInputArea = validatedFeatures.reduce((sum, feature) => {
      return sum + turf.area(feature);
    }, 0);

    console.log('📊 Area comparison:', {
      input_total_area: `${totalInputArea.toFixed(2)} m²`,
      output_area: `${finalArea.toFixed(2)} m²`,
      area_efficiency: `${((finalArea / totalInputArea) * 100).toFixed(2)}%`,
      overlap_reduction: `${(totalInputArea - finalArea).toFixed(2)} m²`
    });

    // Combine properties from all input features
    console.log('🔄 Combining properties from all input features...');
    const combinedProperties = {
      operation: 'union',
      unionDate: new Date().toISOString(),
      inputFeatureCount: features.length,
      validFeatureCount: validatedFeatures.length,
      processedFeatures: validatedFeatures.length,
      totalArea: finalArea,
      totalInputArea,
      areaEfficiency: (finalArea / totalInputArea) * 100,
      overlapReduction: totalInputArea - finalArea,
      unionSteps
    };

    // Add properties from source features
    if (options.preserveProperties) {
      console.log('🔄 Preserving original properties');
      const sourceProperties = {};
      validatedFeatures.forEach((feature, index) => {
        sourceProperties[`source_${index + 1}`] = feature.properties || {};
      });
      combinedProperties.sourceProperties = sourceProperties;
    }

    // Add names from all features
    const featureNames = validatedFeatures
      .map(f => f.properties?.name)
      .filter(name => name)
      .join(', ');
    
    if (featureNames) {
      combinedProperties.sourceNames = featureNames;
      console.log('📝 Combined source names:', featureNames);
    }

    const finalFeature = {
      ...result,
      properties: combinedProperties
    };

    const finalResult = {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: [finalFeature]
      },
      metadata: {
        operation: 'union',
        inputFeatures: features.length,
        validatedFeatures: validatedFeatures.length,
        outputFeatures: 1,
        totalArea: finalArea,
        totalInputArea,
        areaEfficiency: (finalArea / totalInputArea) * 100,
        overlapReduction: totalInputArea - finalArea,
        bounds,
        centroid: centroid.geometry.coordinates,
        unionSteps,
        executionTime: Date.now()
      }
    };

    console.log('✅ Union operation completed successfully!');
    console.log('📤 Final result summary:', {
      success: true,
      input_features: features.length,
      validated_features: validatedFeatures.length,
      output_features: 1,
      final_area: `${finalArea.toFixed(2)} m²`,
      efficiency: `${((finalArea / totalInputArea) * 100).toFixed(2)}%`,
      successful_union_steps: unionSteps.filter(step => step.success).length,
      total_union_steps: unionSteps.length
    });

    return finalResult;

  } catch (error) {
    console.error('❌ Union operation failed:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      input_features: features?.length || 0,
      feature_types: features?.map(f => f?.geometry?.type) || []
    });

    const errorResult = {
      success: false,
      error: `Union operation failed: ${error.message}`,
      operation: 'union'
    };

    console.log('📤 Error result:', errorResult);
    return errorResult;
  }
};

/**
 * Validate features for union operation
 * @param {Array} features - Features to validate
 * @returns {Object} Validation result
 */
export const validateUnionInput = (features) => {
  console.log('🔍 Validating union input...');
  console.log('📊 Features to validate:', features?.length);
  
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    polygonCount: 0,
    details: []
  };

  if (!features || !Array.isArray(features)) {
    validation.valid = false;
    validation.errors.push('Input must be an array of features');
    console.error('❌ Invalid input type');
    return validation;
  }

  if (features.length < 1) {
    validation.valid = false;
    validation.errors.push('At least one feature is required for union');
    console.error('❌ No features provided');
    return validation;
  }

  features.forEach((feature, index) => {
    console.log(`🔍 Validating feature ${index + 1}...`);
    
    const featureDetail = {
      index,
      valid: false,
      warnings: [],
      geometryType: null,
      area: null
    };

    if (!feature || !feature.geometry) {
      validation.warnings.push(`Feature ${index + 1}: Missing geometry`);
      featureDetail.warnings.push('Missing geometry');
      console.warn(`⚠️ Feature ${index + 1}: Missing geometry`);
    } else {
      featureDetail.geometryType = feature.geometry.type;
      
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
        validation.warnings.push(`Feature ${index + 1}: Not a polygon (${feature.geometry.type})`);
        featureDetail.warnings.push(`Not a polygon (${feature.geometry.type})`);
        console.warn(`⚠️ Feature ${index + 1}: Not a polygon (${feature.geometry.type})`);
      } else {
        validation.polygonCount++;
        featureDetail.valid = true;
        
        try {
          featureDetail.area = turf.area(feature);
          console.log(`📊 Feature ${index + 1}: ${feature.geometry.type}, ${featureDetail.area.toFixed(2)} m²`);
          
          if (!turf.booleanValid(feature)) {
            validation.warnings.push(`Feature ${index + 1}: Invalid geometry detected`);
            featureDetail.warnings.push('Invalid geometry detected');
            console.warn(`⚠️ Feature ${index + 1}: Invalid geometry detected`);
          } else {
            console.log(`✅ Feature ${index + 1}: Valid polygon`);
          }
        } catch (error) {
          validation.warnings.push(`Feature ${index + 1}: Geometry validation failed - ${error.message}`);
          featureDetail.warnings.push(`Validation failed - ${error.message}`);
          console.warn(`⚠️ Feature ${index + 1}: Validation failed -`, error.message);
        }
      }
    }

    validation.details.push(featureDetail);
  });

  if (validation.polygonCount === 0) {
    validation.valid = false;
    validation.errors.push('No valid polygon features found');
    console.error('❌ No valid polygons');
  }

  console.log('📊 Validation result:', {
    valid: validation.valid,
    polygon_count: validation.polygonCount,
    errors: validation.errors.length,
    warnings: validation.warnings.length,
    total_area: validation.details
      .filter(d => d.area !== null)
      .reduce((sum, d) => sum + d.area, 0)
      .toFixed(2) + ' m²'
  });

  return validation;
};

/**
 * Perform union with detailed intersection analysis
 * @param {Array} features - Features to union
 * @param {Object} options - Options including intersection analysis
 * @returns {Object} Union result with intersection details
 */
export const performUnionWithAnalysis = (features, options = {}) => {
  console.log('🔄 Starting union with intersection analysis...');
  
  try {
    // First validate input
    const validation = validateUnionInput(features);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Get valid polygon features
    const polygonFeatures = features.filter(f => 
      f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry.type)
    );

    console.log('📊 Analyzing intersections before union...');
    const intersectionAnalysis = {
      totalPairs: 0,
      intersectingPairs: 0,
      touchingPairs: 0,
      separatePairs: 0,
      pairDetails: []
    };

    // Analyze all pairs
    for (let i = 0; i < polygonFeatures.length; i++) {
      for (let j = i + 1; j < polygonFeatures.length; j++) {
        intersectionAnalysis.totalPairs++;
        const feature1 = polygonFeatures[i];
        const feature2 = polygonFeatures[j];
        
        const intersects = turf.booleanIntersects(feature1, feature2);
        const touches = turf.booleanTouches(feature1, feature2);
        
        let relationship = 'separate';
        if (intersects) {
          relationship = 'intersects';
          intersectionAnalysis.intersectingPairs++;
        } else if (touches) {
          relationship = 'touches';
          intersectionAnalysis.touchingPairs++;
        } else {
          intersectionAnalysis.separatePairs++;
        }

        console.log(`🔍 Pair ${i}-${j}: ${relationship}`);
        
        intersectionAnalysis.pairDetails.push({
          feature1Index: i,
          feature2Index: j,
          relationship,
          intersects,
          touches
        });
      }
    }

    console.log('📊 Intersection analysis complete:', {
      total_pairs: intersectionAnalysis.totalPairs,
      intersecting: intersectionAnalysis.intersectingPairs,
      touching: intersectionAnalysis.touchingPairs,
      separate: intersectionAnalysis.separatePairs
    });

    // Perform the union
    const unionResult = performUnion(features, options);
    
    if (unionResult.success) {
      // Add intersection analysis to metadata
      unionResult.metadata.intersectionAnalysis = intersectionAnalysis;
      
      console.log('✅ Union with analysis completed successfully!');
      console.log('📊 Final analysis:', {
        union_successful: true,
        intersection_pairs: intersectionAnalysis.intersectingPairs,
        touching_pairs: intersectionAnalysis.touchingPairs,
        separate_pairs: intersectionAnalysis.separatePairs
      });
    }

    return unionResult;

  } catch (error) {
    console.error('❌ Union with analysis failed:', error);
    return {
      success: false,
      error: `Union with analysis failed: ${error.message}`,
      operation: 'union-with-analysis'
    };
  }
};