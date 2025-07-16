// Create this file: api/index.js
// This replaces your current MCP server with the correct API calls

const axios = require('axios');

// GoHighLevel API configuration
const GHL_CONFIG = {
  apiKey: 'pit-aaca741e-47a2-4b1e-b793-820d2621667b',
  baseUrl: 'https://services.leadconnectorhq.com',
  locationId: '9hxHySEz2LSjRxkhuGQs',
  version: '2021-07-28'
};

// Create axios instance with correct headers
const ghlApi = axios.create({
  baseURL: GHL_CONFIG.baseUrl,
  headers: {
    'Authorization': `Bearer ${GHL_CONFIG.apiKey}`,
    'Version': GHL_CONFIG.version,
    'Content-Type': 'application/json'
  }
});

// MCP Server Tools
const TOOLS = [
  {
    name: 'search_contacts',
    description: 'Search for contacts by phone number, email, or name',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number to search' },
        email: { type: 'string', description: 'Email to search' },
        query: { type: 'string', description: 'General search query' }
      }
    }
  },
  {
    name: 'create_contact',
    description: 'Create a new contact',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' }
      },
      required: ['firstName', 'phone']
    }
  },
  {
    name: 'send_sms',
    description: 'Send SMS message to a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact ID' },
        phone: { type: 'string', description: 'Phone number if no contact ID' },
        message: { type: 'string', description: 'Message to send' }
      },
      required: ['message']
    }
  }
];

// Tool execution functions
async function searchContacts(args) {
  try {
    const params = {
      locationId: GHL_CONFIG.locationId
    };
    
    if (args.phone) params.query = args.phone;
    else if (args.email) params.query = args.email;
    else if (args.query) params.query = args.query;
    
    const response = await ghlApi.get('/contacts/', { params });
    
    return {
      success: true,
      data: response.data,
      message: `Found ${response.data.contacts.length} contact(s)`,
      searchQuery: params.query
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

async function createContact(args) {
  try {
    const contactData = {
      locationId: GHL_CONFIG.locationId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone
    };
    
    const response = await ghlApi.post('/contacts/', contactData);
    
    return {
      success: true,
      data: response.data,
      message: `Contact created successfully: ${args.firstName} ${args.lastName}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

async function sendSMS(args) {
  try {
    let contactId = args.contactId;
    
    // If no contact ID, try to find contact by phone
    if (!contactId && args.phone) {
      const searchResult = await searchContacts({ phone: args.phone });
      if (searchResult.success && searchResult.data.contacts.length > 0) {
        contactId = searchResult.data.contacts[0].id;
      }
    }
    
    if (!contactId) {
      return {
        success: false,
        error: 'No contact found. Please provide contactId or phone number of existing contact.'
      };
    }
    
    const messageData = {
      type: 'SMS',
      contactId: contactId,
      message: args.message
    };
    
    const response = await ghlApi.post('/conversations/messages', messageData);
    
    return {
      success: true,
      data: response.data,
      message: `SMS sent successfully to contact ${contactId}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Main handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { method, url } = req;
  
  try {
    // Health check
    if (method === 'GET' && url === '/health') {
      res.json({
        status: 'healthy',
        server: 'ghl-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        api: {
          connected: true,
          endpoint: GHL_CONFIG.baseUrl,
          locationId: GHL_CONFIG.locationId
        }
      });
      return;
    }
    
    // Tools list
    if (method === 'GET' && url === '/tools') {
      res.json({
        tools: TOOLS,
        count: TOOLS.length
      });
      return;
    }
    
    // SSE endpoint for ChatGPT
    if (url === '/sse' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.write('data: {"type":"connection","status":"connected","tools":3}\n\n');
      
      // Keep alive
      const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
      return;
    }
    
    // Handle MCP tool calls
    if (url === '/sse' && method === 'POST') {
      const { jsonrpc, method: rpcMethod, params, id } = req.body;
      
      if (rpcMethod === 'tools/list') {
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: TOOLS
          }
        });
        return;
      }
      
      if (rpcMethod === 'tools/call') {
        const { name, arguments: args } = params;
        let result;
        
        switch (name) {
          case 'search_contacts':
            result = await searchContacts(args);
            break;
          case 'create_contact':
            result = await createContact(args);
            break;
          case 'send_sms':
            result = await sendSMS(args);
            break;
          default:
            result = { success: false, error: `Unknown tool: ${name}` };
        }
        
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
        return;
      }
    }
    
    // Default response
    res.json({
      message: 'GoHighLevel MCP Server',
      endpoints: {
        health: '/health',
        tools: '/tools',
        sse: '/sse (GET for connection, POST for tool calls)'
      },
      tools: TOOLS.map(t => t.name)
    });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
