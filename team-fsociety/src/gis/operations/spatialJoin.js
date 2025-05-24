import * as turf from '@turf/turf';

/**
 * Perform spatial join - check which points lie within polygons
 * @param {Array} pointFeatures - Array of point features
 * @param {Array} polygonFeatures - Array of polygon features
 * @param {Object} options - Join options
 * @returns {Object} Spatial join result
 */
export const performSpatialJoin = (pointFeatures, polygonFeatures, options = {}) => {
  try {
    if (!pointFeatures || !Array.isArray(pointFeatures) || pointFeatures.length === 0) {
      throw new Error('No point features provided');
    }

    if (!polygonFeatures || !Array.isArray(polygonFeatures) || polygonFeatures.length === 0) {
      throw new Error('No polygon features provided');
    }

    // Filter valid point features
    const validPoints = pointFeatures.filter(feature => 
      feature.geometry && 
      ['Point', 'MultiPoint'].includes(feature.geometry.type)
    );

    // Filter valid polygon features
    const validPolygons = polygonFeatures.filter(feature => 
      feature.geometry && 
      ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
    );

    if (validPoints.length === 0) {
      throw new Error('No valid point features found');
    }

    if (validPolygons.length === 0) {
      throw new Error('No valid polygon features found');
    }

    const joinedFeatures = [];
    const pointPolygonMap = new Map();
    const polygonCounts = new Map();
    const unmatchedPoints = [];

    // Initialize polygon counts
    validPolygons.forEach((polygon, index) => {
      polygonCounts.set(index, {
        polygon: polygon,
        count: 0,
        points: []
      });
    });

    // Check each point against each polygon
    validPoints.forEach((point, pointIndex) => {
      let foundMatch = false;
      const pointCoords = point.geometry.type === 'Point' 
        ? point.geometry.coordinates 
        : point.geometry.coordinates[0]; // For MultiPoint, take first point

      for (let polygonIndex = 0; polygonIndex < validPolygons.length; polygonIndex++) {
        const polygon = validPolygons[polygonIndex];

        try {
          // Check if point is within polygon
          const isWithin = turf.booleanPointInPolygon(pointCoords, polygon);

          if (isWithin) {
            foundMatch = true;
            
            // Create joined feature
            const joinedFeature = {
              type: 'Feature',
              geometry: point.geometry,
              properties: {
                ...point.properties,
                // Add polygon properties with prefix
                ...Object.fromEntries(
                  Object.entries(polygon.properties || {}).map(([key, value]) => 
                    [`polygon_${key}`, value]
                  )
                ),
                // Spatial join metadata
                spatialJoin: {
                  joinDate: new Date().toISOString(),
                  pointIndex: pointIndex,
                  polygonIndex: polygonIndex,
                  operation: 'point-in-polygon'
                }
              }
            };

            joinedFeatures.push(joinedFeature);

            // Update counts and mapping
            pointPolygonMap.set(pointIndex, polygonIndex);
            const polygonData = polygonCounts.get(polygonIndex);
            polygonData.count++;
            polygonData.points.push({
              index: pointIndex,
              feature: point,
              coordinates: pointCoords
            });

            // If not allowing multiple matches, break after first match
            if (!options.allowMultipleMatches) {
              break;
            }
          }
        } catch (spatialError) {
          console.warn(`Spatial check failed for point ${pointIndex} and polygon ${polygonIndex}:`, spatialError);
        }
      }

      if (!foundMatch) {
        unmatchedPoints.push({
          index: pointIndex,
          feature: point,
          coordinates: pointCoords
        });
      }
    });

    // Calculate statistics
    const statistics = {
      totalPoints: validPoints.length,
      matchedPoints: joinedFeatures.length,
      unmatchedPoints: unmatchedPoints.length,
      matchPercentage: (joinedFeatures.length / validPoints.length) * 100,
      polygonStatistics: Array.from(polygonCounts.entries()).map(([index, data]) => ({
        polygonIndex: index,
        pointCount: data.count,
        polygonArea: turf.area(data.polygon),
        pointDensity: data.count / turf.area(data.polygon)
      }))
    };

    return {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: joinedFeatures
      },
      metadata: {
        operation: 'spatial-join',
        joinType: 'point-in-polygon',
        inputPoints: validPoints.length,
        inputPolygons: validPolygons.length,
        outputFeatures: joinedFeatures.length,
        statistics,
        unmatchedPoints: options.includeUnmatched ? unmatchedPoints : null,
        executionTime: Date.now()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Spatial join operation failed: ${error.message}`,
      operation: 'spatial-join'
    };
  }
};

/**
 * Perform polygon-to-polygon spatial join (intersects, contains, etc.)
 * @param {Array} sourcePolygons - Source polygon features
 * @param {Array} targetPolygons - Target polygon features
 * @param {string} spatialRelation - Type of spatial relationship
 * @param {Object} options - Join options
 * @returns {Object} Polygon spatial join result
 */
export const performPolygonSpatialJoin = (sourcePolygons, targetPolygons, spatialRelation = 'intersects', options = {}) => {
  try {
    const validSources = sourcePolygons.filter(feature => 
      feature.geometry && 
      ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
    );

    const validTargets = targetPolygons.filter(feature => 
      feature.geometry && 
      ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
    );

    if (validSources.length === 0 || validTargets.length === 0) {
      throw new Error('Insufficient valid polygon features');
    }

    const joinedFeatures = [];
    const relationshipCounts = {
      intersects: 0,
      contains: 0,
      within: 0,
      overlaps: 0,
      touches: 0
    };

    validSources.forEach((sourcePolygon, sourceIndex) => {
      const matches = [];

      validTargets.forEach((targetPolygon, targetIndex) => {
        try {
          let hasRelationship = false;
          let relationshipType = '';

          // Check specified spatial relationship
          switch (spatialRelation.toLowerCase()) {
            case 'intersects':
              hasRelationship = turf.booleanIntersects(sourcePolygon, targetPolygon);
              relationshipType = 'intersects';
              break;
            case 'contains':
              hasRelationship = turf.booleanContains(sourcePolygon, targetPolygon);
              relationshipType = 'contains';
              break;
            case 'within':
              hasRelationship = turf.booleanWithin(sourcePolygon, targetPolygon);
              relationshipType = 'within';
              break;
            case 'overlaps':
              hasRelationship = turf.booleanOverlap(sourcePolygon, targetPolygon);
              relationshipType = 'overlaps';
              break;
            case 'touches':
              hasRelationship = turf.booleanTouches(sourcePolygon, targetPolygon);
              relationshipType = 'touches';
              break;
            default:
              throw new Error(`Unsupported spatial relationship: ${spatialRelation}`);
          }

          if (hasRelationship) {
            matches.push({
              targetIndex,
              targetFeature: targetPolygon,
              relationshipType
            });

            relationshipCounts[relationshipType]++;
          }

        } catch (relationError) {
          console.warn(`Relationship check failed for source ${sourceIndex} and target ${targetIndex}:`, relationError);
        }
      });

      // Create joined feature if matches found
      if (matches.length > 0) {
        const joinedFeature = {
          type: 'Feature',
          geometry: sourcePolygon.geometry,
          properties: {
            ...sourcePolygon.properties,
            spatialJoin: {
              joinDate: new Date().toISOString(),
              sourceIndex: sourceIndex,
              relationshipType: spatialRelation,
              matchCount: matches.length,
              matches: matches.map(match => ({
                targetIndex: match.targetIndex,
                targetProperties: match.targetFeature.properties || {}
              }))
            }
          }
        };

        // Add aggregated target properties if requested
        if (options.aggregateProperties) {
          const aggregatedProps = aggregateProperties(matches.map(m => m.targetFeature), options.aggregationMethod);
          joinedFeature.properties.aggregated = aggregatedProps;
        }

        joinedFeatures.push(joinedFeature);
      }
    });

    return {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: joinedFeatures
      },
      metadata: {
        operation: 'polygon-spatial-join',
        spatialRelation,
        inputSources: validSources.length,
        inputTargets: validTargets.length,
        outputFeatures: joinedFeatures.length,
        relationshipCounts,
        executionTime: Date.now()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Polygon spatial join operation failed: ${error.message}`,
      operation: 'polygon-spatial-join'
    };
  }
};

/**
 * Count points within polygons
 * @param {Array} pointFeatures - Point features to count
 * @param {Array} polygonFeatures - Polygon features
 * @param {Object} options - Count options
 * @returns {Object} Point count result
 */
export const countPointsInPolygons = (pointFeatures, polygonFeatures, options = {}) => {
  try {
    const spatialJoinResult = performSpatialJoin(pointFeatures, polygonFeatures, options);

    if (!spatialJoinResult.success) {
      throw new Error(spatialJoinResult.error);
    }

    // Create polygon features with point counts
    const polygonCounts = new Map();
    
    // Initialize counts
    polygonFeatures.forEach((polygon, index) => {
      if (polygon.geometry && ['Polygon', 'MultiPolygon'].includes(polygon.geometry.type)) {
        polygonCounts.set(index, {
          polygon: polygon,
          count: 0,
          points: []
        });
      }
    });

    // Count points from spatial join result
    spatialJoinResult.result.features.forEach(joinedFeature => {
      const polygonIndex = joinedFeature.properties.spatialJoin.polygonIndex;
      if (polygonCounts.has(polygonIndex)) {
        const polygonData = polygonCounts.get(polygonIndex);
        polygonData.count++;
        polygonData.points.push(joinedFeature);
      }
    });

    // Create result features with counts
    const resultFeatures = Array.from(polygonCounts.entries()).map(([index, data]) => ({
      type: 'Feature',
      geometry: data.polygon.geometry,
      properties: {
        ...data.polygon.properties,
        pointCount: data.count,
        pointDensity: data.count / turf.area(data.polygon),
        polygonArea: turf.area(data.polygon),
        countOperation: {
          countDate: new Date().toISOString(),
          polygonIndex: index,
          totalPoints: pointFeatures.length
        }
      }
    }));

    // Calculate summary statistics
    const counts = Array.from(polygonCounts.values()).map(data => data.count);
    const statistics = {
      totalPolygons: resultFeatures.length,
      totalPoints: pointFeatures.length,
      pointsWithinPolygons: spatialJoinResult.metadata.statistics.matchedPoints,
      pointsOutsidePolygons: spatialJoinResult.metadata.statistics.unmatchedPoints,
      averagePointsPerPolygon: counts.reduce((sum, count) => sum + count, 0) / counts.length,
      minPointsPerPolygon: Math.min(...counts),
      maxPointsPerPolygon: Math.max(...counts),
      emptyPolygons: counts.filter(count => count === 0).length
    };

    return {
      success: true,
      result: {
        type: 'FeatureCollection',
        features: resultFeatures
      },
      metadata: {
        operation: 'count-points-in-polygons',
        inputPoints: pointFeatures.length,
        inputPolygons: polygonFeatures.length,
        outputFeatures: resultFeatures.length,
        statistics,
        executionTime: Date.now()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Count points in polygons operation failed: ${error.message}`,
      operation: 'count-points-in-polygons'
    };
  }
};

/**
 * Aggregate properties from multiple features
 * @param {Array} features - Features to aggregate
 * @param {string} method - Aggregation method (sum, average, count, etc.)
 * @returns {Object} Aggregated properties
 */
function aggregateProperties(features, method = 'count') {
  const aggregated = {};
  
  if (features.length === 0) {
    return aggregated;
  }

  // Get all numeric properties
  const numericProps = new Set();
  features.forEach(feature => {
    if (feature.properties) {
      Object.entries(feature.properties).forEach(([key, value]) => {
        if (typeof value === 'number' && !isNaN(value)) {
          numericProps.add(key);
        }
      });
    }
  });

  // Aggregate numeric properties
  Array.from(numericProps).forEach(prop => {
    const values = features
      .map(f => f.properties?.[prop])
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length > 0) {
      switch (method.toLowerCase()) {
        case 'sum':
          aggregated[`${prop}_sum`] = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
        case 'mean':
          aggregated[`${prop}_avg`] = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'min':
          aggregated[`${prop}_min`] = Math.min(...values);
          break;
        case 'max':
          aggregated[`${prop}_max`] = Math.max(...values);
          break;
        case 'count':
        default:
          aggregated[`${prop}_count`] = values.length;
          break;
      }
    }
  });

  // Add feature count
  aggregated.feature_count = features.length;

  return aggregated;
}