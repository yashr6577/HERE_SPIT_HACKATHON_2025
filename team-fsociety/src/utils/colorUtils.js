/**
 * Generate a random distinguishable color from a predefined palette
 * @returns {string} Hex color string
 */
export const generateRandomColor = () => {
  const distinguishableColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Mint
    '#FECA57', // Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
    '#10AC84', // Green
    '#EE5A6F', // Rose
    '#C44569', // Dark Pink
    '#F8B500', // Gold
    '#7158e2', // Indigo
    '#3d9970', // Olive
    '#ff851b', // Burnt Orange
    '#85144b', // Maroon
    '#2ecc40', // Lime
    '#39cccc'  // Aqua
  ];
  
  return distinguishableColors[Math.floor(Math.random() * distinguishableColors.length)];
};

/**
 * Generate a set of distinguishable colors
 * @param {number} count - Number of colors needed
 * @returns {string[]} Array of hex color strings
 */
export const generateColorSet = (count) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#10AC84', '#EE5A6F', '#C44569', '#F8B500', '#7158e2',
    '#3d9970', '#ff851b', '#85144b', '#2ecc40', '#39cccc'
  ];
  
  if (count <= colors.length) {
    return colors.slice(0, count);
  }
  
  // If we need more colors than predefined, generate additional ones
  const result = [...colors];
  for (let i = colors.length; i < count; i++) {
    result.push(generateHSLColor(i));
  }
  
  return result;
};

/**
 * Generate a color using HSL for better distribution
 * @param {number} index - Index for color generation
 * @returns {string} Hex color string
 */
export const generateHSLColor = (index) => {
  const hue = (index * 137.508) % 360; // Golden angle approximation
  const saturation = 70 + (index % 3) * 10; // 70-90%
  const lightness = 45 + (index % 4) * 10;  // 45-75%
  
  return hslToHex(hue, saturation, lightness);
};

/**
 * Convert HSL to Hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string
 */
export const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Convert hex color to RGBA with alpha
 * @param {string} hex - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Get contrasting text color (black or white) for a background color
 * @param {string} hexColor - Background hex color
 * @returns {string} Either '#000000' or '#ffffff'
 */
export const getContrastColor = (hexColor) => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

/**
 * Darken a hex color by a percentage
 * @param {string} hex - Hex color string
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export const darkenColor = (hex, percent) => {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  
  return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
};

/**
 * Lighten a hex color by a percentage
 * @param {string} hex - Hex color string
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
export const lightenColor = (hex, percent) => {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return `#${(0x1000000 + (R > 255 ? 255 : R) * 0x10000 +
    (G > 255 ? 255 : G) * 0x100 +
    (B > 255 ? 255 : B)).toString(16).slice(1)}`;
};

/**
 * Generate a color scheme based on a base color
 * @param {string} baseColor - Base hex color
 * @param {number} count - Number of colors to generate
 * @returns {string[]} Array of related colors
 */
export const generateColorScheme = (baseColor, count = 5) => {
  const colors = [baseColor];
  
  for (let i = 1; i < count; i++) {
    const variation = i * 15; // Vary by 15% each step
    if (i % 2 === 0) {
      colors.push(lightenColor(baseColor, variation));
    } else {
      colors.push(darkenColor(baseColor, variation));
    }
  }
  
  return colors;
};

/**
 * Validate if a string is a valid hex color
 * @param {string} hex - Potential hex color string
 * @returns {boolean} True if valid hex color
 */
export const isValidHexColor = (hex) => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

/**
 * Get a color based on layer type
 * @param {string} layerType - Type of the layer (geojson, shapefile, etc.)
 * @returns {string} Appropriate color for the layer type
 */
export const getLayerTypeColor = (layerType) => {
  const typeColors = {
    'geojson': '#4ECDC4',
    'shapefile': '#FF6B6B',
    'kml': '#45B7D1',
    'wkt': '#96CEB4',
    'gpx': '#FECA57',
    'manual': '#FF9FF3',
    'result': '#27ae60'
  };
  
  return typeColors[layerType.toLowerCase()] || generateRandomColor();
};