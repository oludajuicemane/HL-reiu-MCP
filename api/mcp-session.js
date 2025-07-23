// api/mcp-session.js
// Complete session-based MCP server for Vercel

const axios = require('axios');

// In-memory session store
const sessions = new Map();

// Clean up old sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastUsed < oneHourAgo) {
      sessions.delete(sessionId);
    }
  }
}, 10 * 60 * 1000);

// Get session ID from request
function getSessionId(req) {
  return req.headers['x-thread-id'] || 
         req.headers['x-conversation-id'] || 
         req.headers['x-session-id'] || 
         'default-session';
}

// Create GoHighLevel API client
function createGHLClient(apiKey, locationId) {
  return axios.create({
    baseURL: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
    headers: {
      'Authorization': Bearer ${apiKey},
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  });
}

// Test API connection
async function testConnection(apiKey, locationId) {
  try {
    const client = createGHLClient(apiKey, locationId);
    await client.get(/locations/${locationId});
    return true;
  } catch (error) {
    throw new Error(Invalid credentials: ${error.message});
  }
}

// Get session credentials
function getSession(req) {
  const sessionId = getSessionId(req);
  const session = sessions.get(sessionId);
  
  if (!session) {
    throw new Error('No active session found. Please authenticate first.');
  }
  
  // Update last used time
  session.lastUsed = Date.now();
  return session;
}

// Authentication tool
async function authenticate(req, args) {
  const { apiKey, locationId } = args;
  
  if (!apiKey || !locationId) {
    throw new Error('Both apiKey and locationId are required');
  }
  
  // Test credentials
  await testConnection(apiKey, locationId);
  
  // Store in session
  const sessionId = getSessionId(req);
  sessions.set(sessionId, {
    apiKey,
    locationId,
    createdAt: Date.now(),
    lastUsed: Date.now()
  });
  
  return {
    success: true,
    message: 'Authentication successful! You can now use all GoHighLevel tools.',
    sessionId,
    expiresIn: '1 hour'
  };
}

// Search contacts tool
async function searchContacts(session, args) {
  const client = createGHLClient(session.apiKey, session.locationId);
  const { query, limit = 10 } = args;
  
  try {
    const response = await client.get('/contacts/', {
      params: {
        locationId: session.locationId,
        query,
        limit
      }
    });
    
    return {
      success: true,
      contacts: response.data.contacts || [],
      total: response.data.total || 0
    };
  } catch (error) {
    throw new Error(Failed to search contacts: ${error.message});
  }
}

// Send message tool
async function sendMessage(session, args) {
  const client = createGHLClient(session.apiKey, session.locationId);
  const { contactId, message, type = 'SMS', subject } = args;
  
  try {
    const payload = {
      type,
      contactId,
      message
    };
    
    if (type === 'Email' && subject) {
      payload.subject = subject;
    }
    
    const response = await client.post('/conversations/messages', payload);
    
    return {
      success: true,
      messageId: response.data.messageId,
      conversationId: response.data.conversationId
    };
  } catch (error) {
    throw new Error(Failed to send message: ${error.message});
  }
}

// Create blog post tool
async function createBlogPost(session, args) {
  const client = createGHLClient(session.apiKey, session.locationId);
  const { title, content, status = 'draft' } = args;
  
  try {
    const response = await client.post('/blogs/', {
      locationId: session.locationId,
      title,
      content,
      status
    });
    
    return {
      success: true,
      blogId: response.data.id,
      url: response.data.url
    };
  } catch (error) {
    throw new Error(Failed to create blog post: ${error.message});
  }
}

// Get opportunities tool
async function getOpportunities(session, args) {
  const client = createGHLClient(session.apiKey, session.locationId);
  const { limit = 20, status = 'open' } = args;
  
  try {
    const response = await client.get('/opportunities/search', {
      params: {
        location_id: session.locationId,
        limit,
        status
      }
    });
    
    return {
      success: true,
      opportunities: response.data.opportunities || [],
      total: response.data.total || 0
    };
  } catch (error) {
    throw new Error(Failed to get opportunities: ${error.message});
  }
}

// All available tools
const tools = {
  authenticate: {
    name: 'authenticate',
    description: 'Authenticate with GoHighLevel credentials. Must be called before using any other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Your GoHighLevel API key'
        },
        locationId: {
          type: 'string',
          description: 'Your GoHighLevel location ID'
        }
      },
      required: ['apiKey', 'locationId']
    },
    handler: authenticate
  },
  
  search_contacts: {
    name: 'search_contacts',
    description: 'Search for contacts in GoHighLevel CRM',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (email, phone, name, etc.)'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results',
          default: 10
        }
      },
      required: ['query']
    },
    handler: searchContacts
  },
  
  send_message: {
    name: 'send_message',
    description: 'Send SMS or email message to a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'ID of the contact to message'
        },
        message: {
          type: 'string',
          description: 'Message content'
        },
        type: {
          type: 'string',
          enum: ['SMS', 'Email'],
          description: 'Message type',
          default: 'SMS'
        },
        subject: {
          type: 'string',
          description: 'Email subject (required for email type)'
        }
      },
      required: ['contactId', 'message']
    },
    handler: sendMessage
  },
  
  create_blog_post: {
    name: 'create_blog_post',
    description: 'Create a new blog post',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Blog post title'
        },
        content: {
          type: 'string',
          description: 'Blog post content (HTML)'
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publication status',
          default: 'draft'
        }
      },
      required: ['title', 'content']
    },
    handler: createBlogPost
  },
  
  get_opportunities: {
    name: 'get_opportunities',
    description: 'Get opportunities from the sales pipeline',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of results',
          default: 20
        },
        status: {
          type: 'string',
          enum: ['open', 'won', 'lost', 'abandoned'],
          description: 'Opportunity status',
          default: 'open'
        }
      }
    },
    handler: getOpportunities
  }
};

// Main API handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Thread-ID, X-Conversation-ID, X-Session-ID');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Health check
    if (req.method === 'GET') {
      return res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: 'session-memory',
        activeSessions: sessions.size,
        availableTools: Object.keys(tools).length
      });
    }
    
    // Handle MCP protocol
    if (req.method === 'POST') {
      const { method, params, id } = req.body;
      
      if (!method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: id || null
        });
      }
      
      // Initialize
      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'ghl-mcp-server-session', version: '1.0.0' }
          },
          id
        });
      }
      
      // List tools
      if (method === 'tools/list') {
        const toolList = Object.values(tools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }));
        
        return res.json({
          jsonrpc: '2.0',
          result: { tools: toolList },
          id
        });
      }
      
      // Call tool
      if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params;
        
        if (!tools[name]) {
          return res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32601, message: Tool '${name}' not found },
            id
          });
        }
        
        const tool = tools[name];
        let result;
        
        try {
          if (name === 'authenticate') {
            // Authentication doesn't need session
            result = await tool.handler(req, toolArgs);
          } else {
            // Other tools need session
            const session = getSession(req);
            result = await tool.handler(session, toolArgs);
          }
          
          return res.json({
            jsonrpc: '2.0',
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            },
            id
          });
          
        } catch (error) {
          // Special handling for authentication errors
          if (error.message.includes('No active session')) {
            return res.status(401).json({
              jsonrpc: '2.0',
              error: {
                code: -32001,
                message: 'Authentication required. Please use the "authenticate" tool first.',
                data: { requiresAuth: true }
              },
              id
            });
          }
          
          return res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message },
            id
          });
        }
      }
      
      // Unknown method
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id
      });
    }
    
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: req.body?.id || null
    });
  }
};


