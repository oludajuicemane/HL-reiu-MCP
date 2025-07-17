// STEP 1: Fix your api/index.js file for Vercel deployment
// Create or update: api/index.js

const { GHLMCPHttpServer } = require('../dist/http-server');

let server;

module.exports = async (req, res) => {
  // Initialize server if not already done
  if (!server) {
    // Import the server class
    const { GHLMCPHttpServer } = await import('../dist/http-server.js');
    server = new GHLMCPHttpServer();
    
    // Override the start method to not call listen (Vercel handles this)
    server.handleRequest = server.app;
  }

  // Handle the request
  return server.handleRequest(req, res);
};


// STEP 3: Update your package.json scripts
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/http-server.js",
    "dev": "ts-node src/http-server.ts",
    "vercel-build": "npm run build"
  }
}

// STEP 4: Check your current deployment
// 1. Go to Vercel Dashboard
// 2. Find your rei-unlock-mcp project
// 3. Check the Build logs for errors
// 4. Check Environment Variables are set:
//    - GHL_API_KEY = pit-aaca741e-47a2-4b1e-b793-820d2621667b
//    - GHL_LOCATION_ID = 9hxHySEz2LSjRxkhuGQs
//    - GHL_BASE_URL = https://services.leadconnectorhq.com
//    - NODE_ENV = production

// STEP 5: Force redeploy with correct server
// Run these commands in your project directory:

// 1. Make sure TypeScript compiles correctly
npm run build

// 2. Test locally first
node dist/http-server.js

// 3. Deploy to Vercel
vercel --prod

// STEP 6: Alternative - Simple fix for immediate testing
// If you just want to test the API connection quickly, create a simple test file:

// api/test.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const response = await axios.get('https://services.leadconnectorhq.com/contacts/search', {
      headers: {
        'Authorization': 'Bearer pit-aaca741e-47a2-4b1e-b793-820d2621667b',
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      params: {
        locationId: '9hxHySEz2LSjRxkhuGQs',
        query: '4107172457'
      }
    });
    
    res.json({
      success: true,
      data: response.data,
      message: 'Real API call successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      response: error.response?.data
    });
  }
};
