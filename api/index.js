// api/index.js - Your original code with body parsing fix
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
    
    console.log('Searching contacts with params:', params);
    const response = await ghlApi.get('/contacts/', { params });
    
    return {
      success: true,
      data: response.data,
      message: `Found ${response.data.contacts?.length || 0} contact(s)`,
      searchQuery: params.query
    };
  } catch (error) {
    console.error('Search contacts error:', error.response?.data || error.message);
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
    
    console.log('Creating contact with data:', contactData);
    const response = await ghlApi.post('/contacts/', contactData);
    
    return {
      success: true,
      data: response.data,
      message: `Contact created successfully: ${args.firstName} ${args.lastName || ''}`
    };
  } catch (error) {
    console.error('Create contact error:', error.response?.data || error.message);
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
      console.log('Looking up contact by phone:', args.phone);
      const searchResult = await searchContacts({ phone: args.phone });
      if (searchResult.success && searchResult.data.contacts?.length > 0) {
        contactId = searchResult.data.contacts[0].id;
        console.log('Found contact ID:', contactId);
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
    
    console.log('Sending SMS with data:', messageData);
    const response = await ghlApi.post('/conversations/messages', messageData);
    
    return {
      success: true,
      data: response.data,
      message: `SMS sent successfully to contact ${contactId}`
    };
  } catch (error) {
    console.error('Send SMS error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Helper function to parse request body
async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      resolve(req.body);
      return;
    }
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (e) {
        console.error('Body parse error:', e.message, 'Body:', body);
        resolve({});
      }
    });
  });
}

// Main handler
module.exports = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
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
    // Parse body for POST requests
    if (method === 'POST') {
      req.body = await parseBody(req);
      console.log('Parsed body:', req.body);
    }
    
    // Health check
    if (method === 'GET' && url === '/health') {
      res.json({
        status: 'healthy',
        server: 'rei-unlock-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        api: {
          connected: true,
          endpoint: GHL_CONFIG.baseUrl,
          locationId: GHL_CONFIG.locationId
        },
        tools: TOOLS.length
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
      
      // Auto-close before Vercel timeout
      setTimeout(() => {
        clearInterval(keepAlive);
        res.end();
      }, 55000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
      return;
    }
    
    // Handle MCP tool calls
    if (url === '/sse' && method === 'POST') {
      const { jsonrpc, method: rpcMethod, params, id } = req.body;
      
      console.log('MCP call:', { jsonrpc, rpcMethod, params, id });
      
      if (rpcMethod === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: TOOLS
          }
        };
        res.json(response);
        return;
      }
      
      if (rpcMethod === 'tools/call') {
        const { name, arguments: args } = params;
        console.log(`Executing tool: ${name} with args:`, args);
        
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
        
        console.log(`Tool ${name} result:`, result);
        
        const response = {
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
        };
        
        res.json(response);
        return;
      }
      
      // Handle other MCP methods
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: { status: 'ok' }
      };
      res.json(response);
      return;
    }
    
    // Default response
    res.json({
      message: 'REI Unlock MCP Server',
      status: 'running',
      endpoints: {
        health: '/health',
        tools: '/tools',
        sse: '/sse (GET for connection, POST for tool calls)'
      },
      tools: TOOLS.map(t => t.name),
      processing_time: `${Date.now() - startTime}ms`
    });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};
