import * as turf from '@turf/turf';

/**
 * Perform intersection between different geometry types
 * @param {Object} feature1 - First feature
 * @param {Object} feature2 - Second feature
 * @param {Object} options - Optional parameters
 * @returns {Object} Intersection result
 */
export const performGeometryIntersection = (feature1, feature2, options = {}) => {
  console.log('🔄 Starting geometry intersection operation...');
  console.log('📊 Feature 1 type:', feature1?.geometry?.type);
  console.log('📊 Feature 2 type:', feature2?.geometry?.type);

  try {
    if (!feature1 || !feature1.geometry || !feature2 || !feature2.geometry) {
      throw new Error('Both features must have valid geometries');
    }

    const type1 = feature1.geometry.type;
    const type2 = feature2.geometry.type;

    // Handle Polygon-LineString intersections (most common for flood-road analysis)
    if ((type1 === 'Polygon' && type2 === 'LineString') || 
        (type1 === 'LineString' && type2 === 'Polygon')) {
      
      console.log('⚡ Performing Polygon-LineString intersection...');
      return performPolygonLineIntersection(feature1, feature2, options);
    }

    // Handle Polygon-Point intersections
    if ((type1 === 'Polygon' && type2 === 'Point') || 
        (type1 === 'Point' && type2 === 'Polygon')) {
      
      console.log('⚡ Performing Polygon-Point intersection...');
      return performPolygonPointIntersection(feature1, feature2, options);
    }

    // Handle Polygon-Polygon intersections (original functionality)
    if (type1 === 'Polygon' && type2 === 'Polygon') {
      console.log('⚡ Performing Polygon-Polygon intersection...');
      return performIntersection(feature1, feature2, options);
    }

    // Handle LineString-LineString intersections
    if (type1 === 'LineString' && type2 === 'LineString') {
      console.log('⚡ Performing LineString-LineString intersection...');
      return performLineLineIntersection(feature1, feature2, options);
    }

    throw new Error(`Unsupported geometry combination: ${type1} and ${type2}`);

  } catch (error) {
    console.error('❌ Geometry intersection failed:', error);
    return {
      success: false,
      error: `Geometry intersection failed: ${error.message}`,
      operation: 'geometry-intersection'
    };
  }
};

/**
 * Intersect polygon with linestring (e.g., flood zone with roads)
 * @param {Object} feature1 - First feature
 * @param {Object} feature2 - Second feature
 * @param {Object} options - Options
 * @returns {Object} Intersection result
 */
export const performPolygonLineIntersection = (feature1, feature2, options = {}) => {
  console.log('🔄 Starting Polygon-LineString intersection...');
  
  try {
    // Ensure correct order: polygon first, line second
    let polygon = feature1.geometry.type === 'Polygon' ? feature1 : feature2;
    let line = feature1.geometry.type === 'LineString' ? feature1 : feature2;

    console.log('📊 Polygon area:', turf.area(polygon).toFixed(2), 'm²');
    console.log('📊 Line length:', turf.length(line, {units: 'kilometers'}).toFixed(2), 'km');

    // Check if line intersects polygon
    const intersects = turf.booleanIntersects(polygon, line);
    console.log('🔍 Geometries intersect:', intersects);

    if (!intersects) {
      console.log('ℹ️ Line does not intersect polygon');
      return {
        success: true,
        result: {
          type: 'FeatureCollection',
          features: []
        },
        metadata: {
          operation: 'polygon-line-intersection',
          inputFeatures: 2,
          outputFeatures: 0,
          intersects: false,
          message: 'Line does not intersect polygon'
        }
      };
    }

    // Get the intersection - this will return line segments within the polygon
    const intersection = turf.lineIntersect(line, polygon);
    console.log('📐 Intersection points found:', intersection.features.length);

    // If we have intersection points, create line segments within the polygon
    let intersectedSegments = [];
    
    if (intersection.features.length > 0) {
      // Use turf.lineSlice or custom logic to extract line segments within polygon
      try {
        // Check which parts of the line are within the polygon
        const lineCoords = line.geometry.coordinates;
        const segmentsInPolygon = [];
        let currentSegment = [];
        
        for (let i = 0; i < lineCoords.length; i++) {
          const point = turf.point(lineCoords[i]);
          const isInside = turf.booleanPointInPolygon(point, polygon);
          
          if (isInside) {
            currentSegment.push(lineCoords[i]);
          } else {
            if (currentSegment.length > 1) {
              // We have a segment inside the polygon
              segmentsInPolygon.push(currentSegment);
            }
            currentSegment = [];
          }
        }
        
        // Don't forget the last segment
        if (currentSegment.length > 1) {
          segmentsInPolygon.push(currentSegment);
        }

        console.log('📊 Segments within polygon:', segmentsInPolygon.length);

        // Create LineString features for each segment
        intersectedSegments = segmentsInPolygon.map((coords, index) => {
          const segmentLine = turf.lineString(coords);
          const segmentLength = turf.length(segmentLine, {units: 'kilometers'});
          
          return {
            type: 'Feature',
            geometry: segmentLine.geometry,
            properties: {
              operation: 'polygon-line-intersection',
              segmentIndex: index,
              lengthKm: segmentLength,
              polygonProperties: polygon.properties || {},
              lineProperties: line.properties || {},
              intersectionDate: new Date().toISOString()
            }
          };
        });

      } catch (segmentError) {
        console.warn('⚠️ Segment extraction failed, using intersection points');
        
        // Fallback: return intersection points
        intersectedSegments = intersection.features.map((point, index) => ({
          ...point,
          properties: {
            operation: 'polygon-line-intersection',
            pointIndex: index,
            polygonProperties: polygon.properties || {},
            lineProperties: line.properties || {},
            intersectionDate: new Date().toISOString()
          }
        }));
      }
    }

    // Calculate metadata
    const totalLength = intersectedSegments.reduce((sum, segment) => {
      if (segment.geometry.type === 'LineString') {
        return sum + turf.length(segment, {units: 'kilometers'});
      }
      return sum;
    }, 0);

    const result = {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: intersectedSegments
      },
      metadata: {
        operation: 'polygon-line-intersection',
        inputFeatures: 2,
        outputFeatures: intersectedSegments.length,
        intersects: intersectedSegments.length > 0,
        totalIntersectedLength: totalLength,
        originalLineLength: turf.length(line, {units: 'kilometers'}),
        polygonArea: turf.area(polygon),
        intersectionPoints: intersection.features.length,
        bounds: intersectedSegments.length > 0 ? turf.bbox(turf.featureCollection(intersectedSegments)) : null,
        executionTime: Date.now()
      }
    };

    console.log('✅ Polygon-LineString intersection completed!');
    console.log('📊 Result summary:', {
      segments_found: intersectedSegments.length,
      total_length: `${totalLength.toFixed(2)} km`,
      intersection_points: intersection.features.length
    });

    return result;

  } catch (error) {
    console.error('❌ Polygon-LineString intersection failed:', error);
    return {
      success: false,
      error: `Polygon-LineString intersection failed: ${error.message}`,
      operation: 'polygon-line-intersection'
    };
  }
};

/**
 * Handle polygon-point intersections
 */
export const performPolygonPointIntersection = (feature1, feature2, options = {}) => {
  console.log('🔄 Starting Polygon-Point intersection...');
  
  try {
    let polygon = feature1.geometry.type === 'Polygon' ? feature1 : feature2;
    let point = feature1.geometry.type === 'Point' ? feature1 : feature2;

    const isInside = turf.booleanPointInPolygon(point, polygon);
    console.log('🔍 Point is inside polygon:', isInside);

    if (!isInside) {
      return {
        success: true,
        result: { type: 'FeatureCollection', features: [] },
        metadata: {
          operation: 'polygon-point-intersection',
          inputFeatures: 2,
          outputFeatures: 0,
          intersects: false
        }
      };
    }

    const resultPoint = {
      ...point,
      properties: {
        ...point.properties,
        operation: 'polygon-point-intersection',
        polygonProperties: polygon.properties || {},
        intersectionDate: new Date().toISOString()
      }
    };

    return {
      success: true,
      result: { type: 'FeatureCollection', features: [resultPoint] },
      metadata: {
        operation: 'polygon-point-intersection',
        inputFeatures: 2,
        outputFeatures: 1,
        intersects: true,
        polygonArea: turf.area(polygon),
        executionTime: Date.now()
      }
    };

  } catch (error) {
    console.error('❌ Polygon-Point intersection failed:', error);
    return {
      success: false,
      error: `Polygon-Point intersection failed: ${error.message}`,
      operation: 'polygon-point-intersection'
    };
  }
};

/**
 * Perform intersection operation between two polygons
 * @param {Object} feature1 - First polygon feature
 * @param {Object} feature2 - Second polygon feature
 * @param {Object} options - Optional parameters
 * @returns {Object} Result with intersection geometry and metadata
 */
export const performIntersection = (feature1, feature2, options = {}) => {
  console.log('🔄 Starting intersection operation...');
  console.log('📊 Input Feature 1:', {
    type: feature1?.geometry?.type,
    properties: feature1?.properties,
    coordinates_length: feature1?.geometry?.coordinates?.length
  });
  console.log('📊 Input Feature 2:', {
    type: feature2?.geometry?.type,
    properties: feature2?.properties,
    coordinates_length: feature2?.geometry?.coordinates?.length
  });

  try {
    if (!feature1 || !feature1.geometry || !feature2 || !feature2.geometry) {
      const error = 'Both features must have valid geometries';
      console.error('❌ Intersection failed:', error);
      throw new Error(error);
    }

    // Validate that both features are polygons
    if (!['Polygon', 'MultiPolygon'].includes(feature1.geometry.type)) {
      const error = `First feature must be a polygon, got: ${feature1.geometry.type}`;
      console.error('❌ Invalid geometry type:', error);
      throw new Error(error);
    }

    if (!['Polygon', 'MultiPolygon'].includes(feature2.geometry.type)) {
      const error = `Second feature must be a polygon, got: ${feature2.geometry.type}`;
      console.error('❌ Invalid geometry type:', error);
      throw new Error(error);
    }

    console.log('✅ Geometry types validated');

    // Validate geometries
    const valid1 = turf.booleanValid(feature1);
    const valid2 = turf.booleanValid(feature2);
    console.log('🔍 Geometry validation:', { feature1_valid: valid1, feature2_valid: valid2 });

    if (!valid1 || !valid2) {
      console.warn('⚠️ Invalid geometry detected, attempting to repair');
      try {
        feature1 = turf.cleanCoords(feature1);
        feature2 = turf.cleanCoords(feature2);
        console.log('🔧 Geometries repaired successfully');
      } catch (cleanError) {
        console.error('❌ Geometry repair failed:', cleanError.message);
        throw new Error(`Geometry repair failed: ${cleanError.message}`);
      }
    }

    // Check if polygons actually intersect
    const intersects = turf.booleanIntersects(feature1, feature2);
    console.log('🔍 Intersection check:', { intersects });

    if (!intersects) {
      console.log('ℹ️ Polygons do not intersect - returning empty result');
      const result = {
        success: true,
        result: {
          type: 'FeatureCollection',
          features: []
        },
        metadata: {
          operation: 'intersection',
          inputFeatures: 2,
          outputFeatures: 0,
          intersects: false,
          message: 'Polygons do not intersect'
        }
      };
      console.log('📤 Final result:', result);
      return result;
    }

    // Perform intersection
    console.log('⚡ Performing intersection calculation...');
    const intersection = turf.intersect(feature1, feature2);
    console.log('📐 Intersection result:', {
      has_result: !!intersection,
      geometry_type: intersection?.geometry?.type,
      coordinates_count: intersection?.geometry?.coordinates?.length
    });

    if (!intersection || !intersection.geometry) {
      console.log('ℹ️ Intersection resulted in null geometry');
      const result = {
        success: true,
        result: {
          type: 'FeatureCollection',
          features: []
        },
        metadata: {
          operation: 'intersection',
          inputFeatures: 2,
          outputFeatures: 0,
          intersects: false,
          message: 'Intersection resulted in null geometry'
        }
      };
      console.log('📤 Final result:', result);
      return result;
    }

    // Calculate metadata
    console.log('📊 Calculating metadata...');
    const area1 = turf.area(feature1);
    const area2 = turf.area(feature2);
    const intersectionArea = turf.area(intersection);
    const bounds = turf.bbox(intersection);
    const centroid = turf.centroid(intersection);

    console.log('📏 Area calculations:', {
      area1: `${area1.toFixed(2)} m²`,
      area2: `${area2.toFixed(2)} m²`,
      intersectionArea: `${intersectionArea.toFixed(2)} m²`,
      overlap_percentage_1: `${((intersectionArea / area1) * 100).toFixed(2)}%`,
      overlap_percentage_2: `${((intersectionArea / area2) * 100).toFixed(2)}%`
    });

    console.log('🗺️ Spatial metadata:', {
      bounds,
      centroid: centroid.geometry.coordinates
    });

    // Combine properties
    const combinedProperties = {
      operation: 'intersection',
      intersectionDate: new Date().toISOString(),
      feature1Properties: feature1.properties || {},
      feature2Properties: feature2.properties || {},
      area1,
      area2,
      intersectionArea,
      overlapPercentage1: (intersectionArea / area1) * 100,
      overlapPercentage2: (intersectionArea / area2) * 100
    };

    // Add original properties if specified
    if (options.preserveProperties) {
      console.log('🔄 Preserving original properties');
      Object.assign(combinedProperties, feature1.properties || {}, feature2.properties || {});
    }

    const result = {
      ...intersection,
      properties: combinedProperties
    };

    const finalResult = {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: [result]
      },
      metadata: {
        operation: 'intersection',
        inputFeatures: 2,
        outputFeatures: 1,
        intersects: true,
        area1,
        area2,
        intersectionArea,
        overlapPercentage1: (intersectionArea / area1) * 100,
        overlapPercentage2: (intersectionArea / area2) * 100,
        bounds,
        centroid: centroid.geometry.coordinates,
        executionTime: Date.now()
      }
    };

    console.log('✅ Intersection completed successfully!');
    console.log('📤 Final result:', finalResult);
    console.log('🎯 Result summary:', {
      success: true,
      features_created: 1,
      intersection_area: `${intersectionArea.toFixed(2)} m²`,
      overlap_percentage: `${((intersectionArea / Math.min(area1, area2)) * 100).toFixed(2)}%`
    });

    return finalResult;

  } catch (error) {
    console.error('❌ Intersection operation failed:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack,
      feature1_type: feature1?.geometry?.type,
      feature2_type: feature2?.geometry?.type
    });

    const errorResult = {
      success: false,
      error: `Intersection operation failed: ${error.message}`,
      operation: 'intersection'
    };

    console.log('📤 Error result:', errorResult);
    return errorResult;
  }
};

/**
 * Perform intersection between multiple features
 * @param {Array} features - Array of polygon features
 * @param {Object} options - Optional parameters
 * @returns {Object} Intersection result
 */
export const performMultipleIntersection = (features, options = {}) => {
  console.log('🔄 Starting multiple intersection operation...');
  console.log('📊 Input features:', features.length);
  
  try {
    if (!features || !Array.isArray(features) || features.length < 2) {
      throw new Error('At least two features are required for intersection');
    }

    // Group features by geometry type
    const polygons = features.filter(f => f.geometry && f.geometry.type === 'Polygon');
    const lines = features.filter(f => f.geometry && f.geometry.type === 'LineString');
    const points = features.filter(f => f.geometry && f.geometry.type === 'Point');

    console.log('📊 Geometry breakdown:', {
      polygons: polygons.length,
      lines: lines.length,
      points: points.length
    });

    const allIntersections = [];

    // Intersect each line with each polygon (flood-affected roads)
    if (polygons.length > 0 && lines.length > 0) {
      console.log('⚡ Performing polygon-line intersections...');
      
      for (let i = 0; i < polygons.length; i++) {
        for (let j = 0; j < lines.length; j++) {
          console.log(`🔍 Intersecting polygon ${i} with line ${j}`);
          const result = performPolygonLineIntersection(polygons[i], lines[j], options);
          
          if (result.success && result.result.features.length > 0) {
            allIntersections.push(...result.result.features);
            console.log(`✅ Found ${result.result.features.length} intersection segments`);
          }
        }
      }
    }

    // Intersect each point with each polygon
    if (polygons.length > 0 && points.length > 0) {
      console.log('⚡ Performing polygon-point intersections...');
      
      for (let i = 0; i < polygons.length; i++) {
        for (let j = 0; j < points.length; j++) {
          const result = performPolygonPointIntersection(polygons[i], points[j], options);
          if (result.success && result.result.features.length > 0) {
            allIntersections.push(...result.result.features);
          }
        }
      }
    }

    // Handle polygon-polygon intersections if multiple polygons exist
    if (polygons.length > 1) {
      console.log('⚡ Performing polygon-polygon intersections...');
      
      for (let i = 0; i < polygons.length; i++) {
        for (let j = i + 1; j < polygons.length; j++) {
          const result = performIntersection(polygons[i], polygons[j], options);
          if (result.success && result.result.features.length > 0) {
            allIntersections.push(...result.result.features);
          }
        }
      }
    }

    console.log('📊 Total intersections found:', allIntersections.length);

    return {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: allIntersections
      },
      metadata: {
        operation: 'multiple-intersection',
        inputFeatures: features.length,
        outputFeatures: allIntersections.length,
        geometryBreakdown: { polygons: polygons.length, lines: lines.length, points: points.length },
        executionTime: Date.now()
      }
    };

  } catch (error) {
    console.error('❌ Multiple intersection operation failed:', error);
    return {
      success: false,
      error: `Multiple intersection operation failed: ${error.message}`,
      operation: 'multiple-intersection'
    };
  }
};

/**
 * Find all pairwise intersections between features
 * @param {Array} features - Array of polygon features
 * @param {Object} options - Optional parameters
 * @returns {Object} All intersection results
 */
export const findAllIntersections = (features, options = {}) => {
  console.log('🔄 Starting all intersections operation...');
  console.log('📊 Input features:', features.length);
  
  try {
    if (!features || !Array.isArray(features) || features.length < 2) {
      throw new Error('At least two features are required');
    }

    const polygonFeatures = features.filter(feature => 
      feature.geometry && 
      ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
    );

    console.log('🔍 Filtered polygon features:', polygonFeatures.length);

    if (polygonFeatures.length < 2) {
      throw new Error('At least two polygon features are required');
    }

    const intersections = [];
    const pairwiseResults = [];
    const totalPairs = (polygonFeatures.length * (polygonFeatures.length - 1)) / 2;

    console.log(`⚡ Checking ${totalPairs} possible pairs...`);

    // Check all pairs
    for (let i = 0; i < polygonFeatures.length; i++) {
      for (let j = i + 1; j < polygonFeatures.length; j++) {
        console.log(`🔍 Checking pair ${i}-${j}`);
        const result = performIntersection(polygonFeatures[i], polygonFeatures[j], options);
        
        pairwiseResults.push({
          feature1Index: i,
          feature2Index: j,
          intersects: result.success && result.result.features.length > 0,
          result: result
        });

        if (result.success && result.result.features.length > 0) {
          const intersection = result.result.features[0];
          intersection.properties = {
            ...intersection.properties,
            pairIndex: `${i}-${j}`,
            feature1Index: i,
            feature2Index: j
          };
          intersections.push(intersection);
          console.log(`✅ Intersection found for pair ${i}-${j}`);
        } else {
          console.log(`❌ No intersection for pair ${i}-${j}`);
        }
      }
    }

    const finalResult = {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: intersections
      },
      metadata: {
        operation: 'all-intersections',
        inputFeatures: polygonFeatures.length,
        outputFeatures: intersections.length,
        totalPairs: pairwiseResults.length,
        intersectingPairs: intersections.length,
        pairwiseResults,
        executionTime: Date.now()
      }
    };

    console.log('✅ All intersections completed!');
    console.log('📤 Final result:', finalResult);
    console.log('🎯 Summary:', {
      total_pairs_checked: totalPairs,
      intersections_found: intersections.length,
      success_rate: `${((intersections.length / totalPairs) * 100).toFixed(1)}%`
    });

    return finalResult;

  } catch (error) {
    console.error('❌ All intersections operation failed:', error);
    return {
      success: false,
      error: `All intersections operation failed: ${error.message}`,
      operation: 'all-intersections'
    };
  }
};

/**
 * Validate features for intersection operation
 * @param {Array} features - Features to validate
 * @returns {Object} Validation result
 */
export const validateIntersectionInput = (features) => {
  console.log('🔍 Validating intersection input...');
  console.log('📊 Features to validate:', features?.length);
  
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    polygonCount: 0
  };

  if (!features || !Array.isArray(features)) {
    validation.valid = false;
    validation.errors.push('Input must be an array of features');
    console.error('❌ Invalid input type');
    return validation;
  }

  if (features.length < 2) {
    validation.valid = false;
    validation.errors.push('At least two features are required for intersection');
    console.error('❌ Insufficient features');
    return validation;
  }

  features.forEach((feature, index) => {
    console.log(`🔍 Validating feature ${index}...`);
    
    if (!feature || !feature.geometry) {
      validation.warnings.push(`Feature ${index}: Missing geometry`);
      console.warn(`⚠️ Feature ${index}: Missing geometry`);
      return;
    }

    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
      validation.warnings.push(`Feature ${index}: Not a polygon (${feature.geometry.type})`);
      console.warn(`⚠️ Feature ${index}: Not a polygon (${feature.geometry.type})`);
      return;
    }

    validation.polygonCount++;

    try {
      if (!turf.booleanValid(feature)) {
        validation.warnings.push(`Feature ${index}: Invalid geometry detected`);
        console.warn(`⚠️ Feature ${index}: Invalid geometry detected`);
      } else {
        console.log(`✅ Feature ${index}: Valid`);
      }
    } catch (error) {
      validation.warnings.push(`Feature ${index}: Geometry validation failed - ${error.message}`);
      console.warn(`⚠️ Feature ${index}: Validation failed -`, error.message);
    }
  });

  if (validation.polygonCount < 2) {
    validation.valid = false;
    validation.errors.push('At least two valid polygon features are required');
    console.error('❌ Insufficient valid polygons');
  }

  console.log('📊 Validation result:', {
    valid: validation.valid,
    polygon_count: validation.polygonCount,
    errors: validation.errors.length,
    warnings: validation.warnings.length
  });

  return validation;
};