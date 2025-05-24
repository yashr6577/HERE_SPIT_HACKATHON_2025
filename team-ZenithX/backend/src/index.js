import express from 'express';
import { calculateRoute, getAlternativeRoutes, getTrafficIncidents } from './controllers/route.controller.js';
import { emergencyRoute } from './controllers/emergency.controller.js';
import { sendMessage } from './controllers/twilio.controller.js';


const app=express();
const PORT=8000;


app.use(express.json());


app.post('/routes/calulate', calculateRoute);
app.get('/routes/traffic', getTrafficIncidents);
app.post('/routes/emergency', emergencyRoute);
app.post('/routes/alternate', getAlternativeRoutes);
app.post('/message', sendMessage);



app.get('/', (req, res) => {
  res.send('Welcome to the HERE API Integration');
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });