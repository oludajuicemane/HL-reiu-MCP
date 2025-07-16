// api/index.js - Enhanced version with full tool calling + session support
// Maintains ALL existing functionality while adding session-based multi-tenant support

const axios = require('axios');

const MCP_PROTOCOL_VERSION = "2024-11-05";

const SERVER_INFO = {
  name: "ghl-mcp-server",
  version: "1.0.0"
};

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
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  });
}

// Test API connection
async function testConnection(apiKey, locationId) {
  try {
    const client = createGHLClient(apiKey, locationId);
    await client.get(`/locations/${locationId}`);
    return true;
  } catch (error) {
    throw new Error(`Invalid credentials: ${error.message}`);
  }
}

// Get session credentials
function getSession(req) {
  const sessionId = getSessionId(req);
  const session = sessions.get(sessionId);
  
  if (!session) {
    throw new Error('No active session found. Please authenticate first.');
  }
  
  session.lastUsed = Date.now();
  return session;
}

// === ORIGINAL TOOLS (your existing functionality) ===
const ORIGINAL_TOOLS = [
  {
    name: "search",
    description: "Search for information in GoHighLevel CRM system",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for GoHighLevel data"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "retrieve",
    description: "Retrieve specific data from GoHighLevel",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the item to retrieve"
        },
        type: {
          type: "string",
          enum: ["contact", "conversation", "blog"],
          description: "Type of item to retrieve"
        }
      },
      required: ["id", "type"]
    }
  }
];

// === SESSION-BASED TOOLS (new functionality) ===
const SESSION_TOOLS = [
  {
    name: "authenticate",
    description: "Authenticate with GoHighLevel credentials. Must be called before using any other session-based tools.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "Your GoHighLevel API key"
        },
        locationId: {
          type: "string",
          description: "Your GoHighLevel location ID"
        }
      },
      required: ["apiKey", "locationId"]
    }
  },
  {
    name: "search_contacts",
    description: "Search for contacts in GoHighLevel CRM (requires authentication)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (email, phone, name, etc.)"
        },
        limit: {
          type: "integer",
          description: "Maximum number of results",
          default: 10
        }
      },
      required: ["query"]
    }
  },
  {
    name: "send_message",
    description: "Send SMS or email message to a contact (requires authentication)",
    inputSchema: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "ID of the contact to message"
        },
        message: {
          type: "string",
          description: "Message content"
        },
        type: {
          type: "string",
          enum: ["SMS", "Email"],
          description: "Message type",
          default: "SMS"
        },
        subject: {
          type: "string",
          description: "Email subject (required for email type)"
        }
      },
      required: ["contactId", "message"]
    }
  },
  {
    name: "create_blog_post",
    description: "Create a new blog post (requires authentication)",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Blog post title"
        },
        content: {
          type: "string",
          description: "Blog post content (HTML)"
        },
        status: {
          type: "string",
          enum: ["draft", "published"],
          description: "Publication status",
          default: "draft"
        }
      },
      required: ["title", "content"]
    }
  },
  {
    name: "get_opportunities",
    description: "Get opportunities from the sales pipeline (requires authentication)",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Maximum number of results",
          default: 20
        },
        status: {
          type: "string",
          enum: ["open", "won", "lost", "abandoned"],
          description: "Opportunity status",
          default: "open"
        }
      }
    }
  }
];

// Combine all tools
const ALL_TOOLS = [...ORIGINAL_TOOLS, ...SESSION_TOOLS];

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MCP] ${message}${data ? ': ' + JSON.stringify(data) : ''}`);
}

// Create proper JSON-RPC 2.0 response
function createJsonRpcResponse(id, result = null, error = null) {
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  return response;
}

// Create proper JSON-RPC 2.0 notification
function createJsonRpcNotification(method, params = {}) {
  return {
    jsonrpc: "2.0",
    method: method,
    params: params
  };
}

// === ORIGINAL TOOL HANDLERS (your existing functionality) ===
function handleOriginalToolsCall(request) {
  const { name, arguments: args } = request.params;
  log("Handling original tools/call request", { tool: name, args });
  
  let content;
  
  if (name === "search") {
    content = [
      {
        type: "text",
        text: `GoHighLevel Search Results for: "${args.query}"\n\n✅ Found Results:\n• Contact: John Doe (john@example.com)\n• Contact: Jane Smith (jane@example.com)\n• Conversation: "Follow-up call scheduled"\n• Blog Post: "How to Generate More Leads"\n\n📊 Search completed successfully in GoHighLevel CRM.`
      }
    ];
  } else if (name === "retrieve") {
    content = [
      {
        type: "text", 
        text: `GoHighLevel ${args.type} Retrieved: ID ${args.id}\n\n📄 Details:\n• Name: Sample ${args.type}\n• Status: Active\n• Last Updated: ${new Date().toISOString()}\n• Source: GoHighLevel CRM\n\n✅ Data retrieved successfully from GoHighLevel.`
      }
    ];
  } else {
    return createJsonRpcResponse(request.id, null, {
      code: -32601,
      message: `Method not found: ${name}`
    });
  }
  
  return createJsonRpcResponse(request.id, {
    content: content
  });
}

// === SESSION-BASED TOOL HANDLERS (new functionality) ===
async function handleSessionToolsCall(request) {
  const { name, arguments: args } = request.params;
  log("Handling session tools/call request", { tool: name, args });
  
  let result;
  
  try {
    if (name === "authenticate") {
      result = await authenticateUser(request, args);
    } else if (name === "search_contacts") {
      const session = getSession(request);
      result = await searchContacts(session, args);
    } else if (name === "send_message") {
      const session = getSession(request);
      result = await sendMessage(session, args);
    } else if (name === "create_blog_post") {
      const session = getSession(request);
      result = await createBlogPost(session, args);
    } else if (name === "get_opportunities") {
      const session = getSession(request);
      result = await getOpportunities(session, args);
    } else {
      return createJsonRpcResponse(request.id, null, {
        code: -32601,
        message: `Session tool not found: ${name}`
      });
    }
    
    return createJsonRpcResponse(request.id, {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
    
  } catch (error) {
    if (error.message.includes('No active session')) {
      return createJsonRpcResponse(request.id, null, {
        code: -32001,
        message: 'Authentication required. Please use the "authenticate" tool first.',
        data: { requiresAuth: true }
      });
    }
    
    return createJsonRpcResponse(request.id, null, {
      code: -32603,
      message: error.message
    });
  }
}

// === TOOL IMPLEMENTATIONS ===
async function authenticateUser(request, args) {
  const { apiKey, locationId } = args;
  
  if (!apiKey || !locationId) {
    throw new Error('Both apiKey and locationId are required');
  }
  
  await testConnection(apiKey, locationId);
  
  const sessionId = getSessionId(request);
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
      total: response.data.total || 0,
      query,
      limit
    };
  } catch (error) {
    throw new Error(`Failed to search contacts: ${error.message}`);
  }
}

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
      conversationId: response.data.conversationId,
      type,
      contactId
    };
  } catch (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

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
      url: response.data.url,
      title,
      status
    };
  } catch (error) {
    throw new Error(`Failed to create blog post: ${error.message}`);
  }
}

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
      total: response.data.total || 0,
      status,
      limit
    };
  } catch (error) {
    throw new Error(`Failed to get opportunities: ${error.message}`);
  }
}

// === MCP PROTOCOL HANDLERS ===
function handleInitialize(request) {
  log("Handling initialize request", request.params);
  
  return createJsonRpcResponse(request.id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {}
    },
    serverInfo: SERVER_INFO
  });
}

function handleToolsList(request) {
  log("Handling tools/list request");
  
  return createJsonRpcResponse(request.id, {
    tools: ALL_TOOLS
  });
}

function handleToolsCall(request) {
  const { name } = request.params;
  
  // Check if it's an original tool (no authentication required)
  const isOriginalTool = ORIGINAL_TOOLS.some(tool => tool.name === name);
  
  if (isOriginalTool) {
    return handleOriginalToolsCall(request);
  }
  
  // Check if it's a session-based tool
  const isSessionTool = SESSION_TOOLS.some(tool => tool.name === name);
  
  if (isSessionTool) {
    return handleSessionToolsCall(request);
  }
  
  // Tool not found
  return createJsonRpcResponse(request.id, null, {
    code: -32601,
    message: `Method not found: ${name}`
  });
}

function handlePing(request) {
  log("Handling ping request");
  return createJsonRpcResponse(request.id, {});
}

// Process JSON-RPC message
function processJsonRpcMessage(message) {
  try {
    log("Processing JSON-RPC message", { method: message.method, id: message.id });
    
    // Validate JSON-RPC format
    if (message.jsonrpc !== "2.0") {
      return createJsonRpcResponse(message.id, null, {
        code: -32600,
        message: "Invalid Request: jsonrpc must be '2.0'"
      });
    }
    
    switch (message.method) {
      case "initialize":
        return handleInitialize(message);
      case "tools/list":
        return handleToolsList(message);
      case "tools/call":
        return handleToolsCall(message);
      case "ping":
        return handlePing(message);
      default:
        return createJsonRpcResponse(message.id, null, {
          code: -32601,
          message: `Method not found: ${message.method}`
        });
    }
  } catch (error) {
    log("Error processing message", error.message);
    return createJsonRpcResponse(message.id, null, {
      code: -32603,
      message: "Internal error",
      data: error.message
    });
  }
}

// Send Server-Sent Event
function sendSSE(res, data) {
  try {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`data: ${message}\n\n`);
    log("Sent SSE message", { type: typeof data });
  } catch (error) {
    log("Error sending SSE", error.message);
  }
}

// Set CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Thread-ID, X-Conversation-ID, X-Session-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// === MAIN REQUEST HANDLER ===
module.exports = async (req, res) => {
  const timestamp = new Date().toISOString();
  log(`${req.method} ${req.url}`);
  log(`User-Agent: ${req.headers['user-agent']}`);
  
  // Set CORS headers
  setCORSHeaders(res);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Health check
  if (req.url === '/health' || req.url === '/') {
    log("Health check requested");
    res.status(200).json({
      status: 'healthy',
      server: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocol: MCP_PROTOCOL_VERSION,
      timestamp: timestamp,
      features: {
        originalTools: ORIGINAL_TOOLS.map(t => t.name),
        sessionTools: SESSION_TOOLS.map(t => t.name),
        totalTools: ALL_TOOLS.length,
        activeSessions: sessions.size
      },
      endpoints: {
        health: '/health',
        sse: '/sse'
      },
      modes: {
        original: 'No authentication required',
        session: 'Authentication required - use authenticate tool first'
      }
    });
    return;
  }
  
  // Favicon handling
  if (req.url?.includes('favicon')) {
    res.status(404).end();
    return;
  }
  
  // MCP SSE endpoint
  if (req.url === '/sse') {
    log("MCP SSE endpoint requested");
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Thread-ID, X-Conversation-ID, X-Session-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    
    // Handle GET (SSE connection)
    if (req.method === 'GET') {
      log("SSE connection established");
      
      // Send immediate initialization notification
      const initNotification = createJsonRpcNotification("notification/initialized", {});
      sendSSE(res, initNotification);
      
      // Send tools available notification
      setTimeout(() => {
        const toolsNotification = createJsonRpcNotification("notification/tools/list_changed", {});
        sendSSE(res, toolsNotification);
      }, 100);
      
      // Keep-alive heartbeat every 25 seconds
      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 25000);
      
      // Cleanup on connection close
      req.on('close', () => {
        log("SSE connection closed");
        clearInterval(heartbeat);
      });
      
      req.on('error', (error) => {
        log("SSE connection error", error.message);
        clearInterval(heartbeat);
      });
      
      // Auto-close after 50 seconds to prevent Vercel timeout
      setTimeout(() => {
        log("SSE connection auto-closing before timeout");
        clearInterval(heartbeat);
        res.end();
      }, 50000);
      
      return;
    }
    
    // Handle POST (JSON-RPC messages)
    if (req.method === 'POST') {
      log("Processing JSON-RPC POST request");
      
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          log("Received POST body", body);
          const message = JSON.parse(body);
          
          // Add request context for session tools
          message.request = req;
          
          const response = processJsonRpcMessage(message);
          
          log("Sending JSON-RPC response", response);
          
          // Send as SSE for MCP protocol compliance
          sendSSE(res, response);
          
          // Close connection after response
          setTimeout(() => {
            res.end();
          }, 100);
          
        } catch (error) {
          log("JSON parse error", error.message);
          const errorResponse = createJsonRpcResponse(null, null, {
            code: -32700,
            message: "Parse error"
          });
          sendSSE(res, errorResponse);
          res.end();
        }
      });
      
      return;
    }
  }
  
  // Default 404
  log("Unknown endpoint", req.url);
  res.status(404).json({ error: 'Not found' });
};
