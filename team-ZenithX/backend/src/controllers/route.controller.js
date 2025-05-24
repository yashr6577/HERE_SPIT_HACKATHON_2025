import  axios from 'axios';
const HERE_API_KEY = "9Dpxsv-LXOYn_WzclZVeaRi8-R2WOJkG75xWaAW01pk";
 

async function calculateRoute(req, res) {
    try {
      const { source, destination, transportMode = 'car' } = req.body;
      
      if (!source || !destination) {
        return res.status(400).json({ 
          success: false, 
          message: 'Source and destination are required' 
        });
      }

      if (!source.lat || !source.lng || !destination.lat || !destination.lng) {
        return res.status(400).json({ 
          success: false, 
          message: 'Source and destination must include lat and lng coordinates' 
        });
      }

      console.log("calc errr");
      

      const response = await axios.get('https://router.hereapi.com/v8/routes', {
        params: {
          apiKey: HERE_API_KEY,
          transportMode,
          origin: `${source.lat},${source.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          return: 'polyline,actions,instructions,summary',
          departureTime: 'any',
          traffic: 'enabled'
        }
      });

      return res.status(200).json({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('Route calculation error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to calculate route',
        error: error.message
      });
    }
  }

  async function getTrafficIncidents(req, res) {
    try {
      const { latitude, longitude, radius = 5000 } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ 
          success: false, 
          message: 'Latitude and longitude are required' 
        });
      }

      const response = await axios.get('https://traffic.ls.hereapi.com/traffic/6.3/incidents', {
        params: {
          apiKey: HERE_API_KEY,
          prox: `${latitude},${longitude},${radius}`,
          criticality: 'minor,major,critical',
          returnJSON: true
        }
      });

      console.log('Traffic incidents response:');
      

      return res.status(200).json({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('Traffic incidents error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch traffic incidents',
        error: error.message
      });
    }
  }

  async function  getAlternativeRoutes(req, res) {
    try {
      const { source, destination, transportMode = 'car', alternatives = 3 } = req.body;
      console.log(source);
      console.log(destination);
      
      if (!source || !destination) {
        return res.status(400).json({ 
          success: false, 
          message: 'Source and destination are required' 
        });
      }

      // Check if source and destination have the required latitude and longitude
      if (!source.lat || !source.lng || !destination.lat || !destination.lng) {
        return res.status(400).json({ 
          success: false, 
          message: 'Source and destination must include lat and lng coordinates' 
        });
      }

      const response = await axios.get('https://router.hereapi.com/v8/routes', {
        params: {
          apiKey: HERE_API_KEY,
          transportMode,
          origin: `${source.lat},${source.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          return: 'polyline,summary',
          alternatives,
        }
      });

      console.log("alternate");
      

      return res.status(200).json({
        success: true,
        data: response.data
      });
    } catch (error) {
      console.error('Alternative routes error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch alternative routes',
        error: error.message
      });
    }
  }


export {
    getAlternativeRoutes,
    getTrafficIncidents,
    calculateRoute,

}