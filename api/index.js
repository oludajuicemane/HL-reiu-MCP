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
