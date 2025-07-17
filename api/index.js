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

// STEP 2: Update your vercel.json configuration
// vercel.json should be:
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/api/index.js" }
  ],
  "functions": {
    "api/index.js": {
      "includeFiles": "dist/**"
    }
  }
}

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

// Then test with: curl https://rei-unlock-mcp.vercel.app/api/test

// STEP 7: Debug current deployment
// Check what's actually deployed:
console.log("Current deployment issues:");
console.log("1. Wrong server code is deployed");
console.log("2. Mock responses instead of real API calls");
console.log("3. Different tool structure than expected");
console.log("");
console.log("To fix:");
console.log("1. Verify your build process compiles the right files");
console.log("2. Check that dist/http-server.js is the correct file");
console.log("3. Ensure Vercel is pointing to the right entry point");
console.log("4. Test environment variables are accessible");
console.log("");
console.log("Expected tools in your real server:");
console.log("- create_contact, search_contacts, get_contact, update_contact");
console.log("- send_sms, send_email, search_conversations");
console.log("- create_blog_post, get_blog_posts");
console.log("- Plus 250+ other tools");
console.log("");
console.log("Current deployed server has:");
console.log("- search, send_message, search_contacts (different structure)");
console.log("- Mock responses with John Doe, Jane Smith");
console.log("- No real API integration");
