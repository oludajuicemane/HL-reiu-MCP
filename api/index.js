// api/index.js - Dynamic credentials version
const axios = require('axios');

// Session storage for user credentials
let userSession = {
  apiKey: null,
  locationId: null,
  authenticated: false,
  ghlApi: null
};

// Base configuration
const GHL_BASE_CONFIG = {
  baseUrl: 'https://services.leadconnectorhq.com',
  version: '2021-07-28'
};

// MCP Server Tools - Updated with authenticate tool
const TOOLS = [
  {
    name: 'authenticate',
    description: 'Set your REI Unlock API credentials for this session',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Private Integrations API Key (starts with pit-)' 
        },
        locationId: { 
          type: 'string', 
          description: 'Location ID from REI Unlock Settings' 
        }
      },
      required: ['apiKey', 'locationId']
    }
  },
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

// Authenticate function - stores user credentials
async function authenticate(args) {
  try {
    console.log('Setting up authentication with user credentials...');
    
    // Validate API key format
    if (!args.apiKey.startsWith('pit-')) {
      return {
        success: false,
        error: 'Invalid API key format. Private Integrations API key must start with "pit-"'
      };
    }
    
    // Create API client with user's credentials
    const ghlApi = axios.create({
      baseURL: GHL_BASE_CONFIG.baseUrl,
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Version': GHL_BASE_CONFIG.version,
        'Content-Type': 'application/json'
      }
    });
    
    // Test the connection
    const response = await ghlApi.get(`/locations/${args.locationId}`);
    
    // Store in session
    userSession = {
      apiKey: args.apiKey,
      locationId: args.locationId,
      authenticated: true,
      ghlApi: ghlApi
    };
    
    console.log('✅ Authentication successful!');
    
    return {
      success: true,
      authenticated: true,
      message: `✅ Connected to REI Unlock successfully!`,
      location: {
        id: args.locationId,
        name: response.data.name || 'Connected Location'
      }
    };
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    
    // Clear session on failure
    userSession = {
      apiKey: null,
      locationId: null,
      authenticated: false,
      ghlApi: null
    };
    
    return {
      success: false,
      authenticated: false,
      error: 'Authentication failed: ' + (error.response?.data?.message || error.message),
      details: error.response?.data
    };
  }
}

// Check if authenticated
function requireAuth() {
  if (!userSession.authenticated || !userSession.ghlApi) {
    throw new Error('Not authenticated. Please call authenticate first with your API key and Location ID.');
  }
  return userSession.ghlApi;
}

// Search contacts function
async function searchContacts(args) {
  try {
    const ghlApi = requireAuth(); // This will throw if not authenticated
    
    const params = {
      locationId: userSession.locationId
    };
    
    // Build search query
    if (args.phone) params.query = args.phone;
    else if (args.email) params.query = args.email;
    else if (args.query) params.query = args.query;
    
    console.log('🔍 Searching contacts with params:', params);
    const response = await ghlApi.get('/contacts/', { params });
    
    const contacts = response.data.contacts || [];
    
    if (contacts.length > 0) {
      const contact = contacts[0];
      const fullName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      
      return {
        success: true,
        found: true,
        contact: {
          id: contact.id,
          name: fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email
        },
        message: `📞 Found: ${fullName}`,
        totalResults: contacts.length
      };
    } else {
      return {
        success: true,
        found: false,
        message: `❌ No contacts found for: ${params.query}`,
        searchQuery: params.query
      };
    }
    
  } catch (error) {
    console.error('❌ Search error:', error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Create contact function
async function createContact(args) {
  try {
    const ghlApi = requireAuth();
    
    const contactData = {
      locationId: userSession.locationId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone
    };
    
    console.log('👤 Creating contact:', contactData);
    const response = await ghlApi.post('/contacts/', contactData);
    
    return {
      success: true,
      contact: response.data.contact,
      message: `✅ Created: ${args.firstName} ${args.lastName || ''}`
    };
    
  } catch (error) {
    console.error('❌ Create contact error:', error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Send SMS function
async function sendSMS(args) {
  try {
    const ghlApi = requireAuth();
    
    let contactId = args.contactId;
    
    // If no contact ID provided, search by phone
    if (!contactId && args.phone) {
      console.log('📱 Looking up contact by phone:', args.phone);
      const searchResult = await searchContacts({ phone: args.phone });
      
      if (searchResult.success && searchResult.found) {
        contactId = searchResult.contact.id;
        console.log('✅ Found contact ID:', contactId);
      } else {
        return {
          success: false,
          error: `Contact not found with phone: ${args.phone}`
        };
      }
    }
    
    if (!contactId) {
      return {
        success: false,
        error: 'No contact ID provided and no phone number to search with'
      };
    }
    
    const messageData = {
      type: 'SMS',
      contactId: contactId,
      message: args.message
    };
    
    console.log('📨 Sending SMS:', messageData);
    const response = await ghlApi.post('/conversations/messages', messageData);
    
    return {
      success: true,
      messageId: response.data.messageId,
      message: `📱 SMS sent to contact ${contactId}!`
    };
    
  } catch (error) {
    console.error('❌ SMS error:', error.message);
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
        console.error('Body parse error:', e.message);
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
      console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    }
    
    // Health check
    if (method === 'GET' && url === '/health') {
      res.json({
        status: 'healthy',
        server: 'rei-unlock-mcp',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        session: {
          authenticated: userSession.authenticated,
          hasApiKey: !!userSession.apiKey,
          hasLocationId: !!userSession.locationId
        },
        tools: TOOLS.length
      });
      return;
    }
    
    // Tools list
    if (method === 'GET' && url === '/tools') {
      res.json({
        tools: TOOLS,
        count: TOOLS.length,
        authenticated: userSession.authenticated
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
      
      res.write(`data: {"type":"connection","status":"connected","authenticated":${userSession.authenticated}}\n\n`);
      
      // Keep alive
      const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
      }, 30000);
      
      // Auto-close
      setTimeout(() => {
        clearInterval(keepAlive);
        res.end();
      }, 55000);
      
      req.on('close', () => clearInterval(keepAlive));
      return;
    }
    
    // Handle MCP tool calls
    if (url === '/sse' && method === 'POST') {
      const { jsonrpc, method: rpcMethod, params, id } = req.body;
      
      console.log('🔧 MCP Call:', rpcMethod, params?.name);
      
      // Handle MCP protocol methods
      if (rpcMethod === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'rei-unlock-mcp', version: '2.0.0' }
          }
        };
        res.json(response);
        return;
      }
      
      if (rpcMethod === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: { tools: TOOLS }
        };
        res.json(response);
        return;
      }
      
      if (rpcMethod === 'tools/call') {
        const { name, arguments: args } = params;
        console.log(`🛠️ Executing: ${name}`, args);
        
        let result;
        
        try {
          switch (name) {
            case 'authenticate':
              result = await authenticate(args);
              break;
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
        } catch (error) {
          result = { success: false, error: error.message };
        }
        
        console.log(`✅ Result:`, result);
        
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
      
      // Default MCP response
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
      authenticated: userSession.authenticated,
      endpoints: {
        health: '/health',
        tools: '/tools',
        sse: '/sse'
      },
      availableTools: TOOLS.map(t => t.name),
      processing_time: `${Date.now() - startTime}ms`
    });
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
