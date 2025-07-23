// api/index.js

const MCP_PROTOCOL_VERSION = "2024-11-05";

const { handleAuthenticate } = require("./mcp-session");

const SERVER_INFO = {
  name: "ghl-mcp-server",
  version: "1.0.0"
};

const TOOLS = [
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

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MCP] ${message}${data ? ': ' + JSON.stringify(data) : ''}`);
}

function createJsonRpcResponse(id, result = null, error = null) {
  const response = { jsonrpc: "2.0", id };
  if (error) response.error = error;
  else response.result = result;
  return response;
}

function createJsonRpcNotification(method, params = {}) {
  return { jsonrpc: "2.0", method, params };
}

function handleInitialize(request) {
  log("Handling initialize request", request.params);
  return createJsonRpcResponse(request.id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO
  });
}

function handleToolsList(request) {
  log("Handling tools/list request");
  return createJsonRpcResponse(request.id, { tools: TOOLS });
}

function handleToolsCall(request) {
  const { name, arguments: args } = request.params;
  log("Handling tools/call request", { tool: name, args });

  let content;
  if (name === "search") {
    content = [{
      type: "text",
      text: `Results for: "${args.query}"`
    }];
  } else if (name === "retrieve") {
    content = [{
      type: "text",
      text: `Retrieved ${args.type} with ID ${args.id}`
    }];
  } else {
    return createJsonRpcResponse(request.id, null, {
      code: -32601,
      message: `Method not found: ${name}`
    });
  }

  return createJsonRpcResponse(request.id, { content });
}

function handlePing(request) {
  log("Ping received");
  return createJsonRpcResponse(request.id, {});
}

function processJsonRpcMessage(message) {
  try {
    if (message.jsonrpc !== "2.0") {
      return createJsonRpcResponse(message.id, null, {
        code: -32600,
        message: "Invalid Request: jsonrpc must be '2.0'"
      });
    }

    switch (message.method) {
      case "initialize": return handleInitialize(message);
      case "tools/list": return handleToolsList(message);
      case "tools/call": return handleToolsCall(message);
      case "ping": return handlePing(message);
      case "authenticate": return handleAuthenticate(message);
      default:
        return createJsonRpcResponse(message.id, null, {
          code: -32601,
          message: `Method not found: ${message.method}`
        });
    }
  } catch (err) {
    log("Error processing message", err.message);
    return createJsonRpcResponse(message.id, null, {
      code: -32603,
      message: "Internal error",
      data: err.message
    });
  }
}

function sendSSE(res, data) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  res.write(`data: ${msg}\n\n`);
}

function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

module.exports = async (req, res) => {
  setCORSHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.url === "/" || req.url === "/health") {
    res.status(200).json({
      status: "healthy",
      server: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocol: MCP_PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
      tools: TOOLS.map(t => t.name),
      endpoint: "/sse"
    });
    return;
  }

  if (req.url === "/sse") {
    if (req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      sendSSE(res, createJsonRpcNotification("notification/initialized"));
      setTimeout(() => {
        sendSSE(res, createJsonRpcNotification("notification/tools/list_changed"));
      }, 100);

      const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
      req.on("close", () => clearInterval(heartbeat));
      req.on("error", () => clearInterval(heartbeat));
      setTimeout(() => res.end(), 50000);

      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => (body += chunk.toString()));
      req.on("end", () => {
        try {
          const msg = JSON.parse(body);
          const response = processJsonRpcMessage(msg);
          sendSSE(res, response);
          setTimeout(() => res.end(), 100);
        } catch (err) {
          sendSSE(res, createJsonRpcResponse(null, null, {
            code: -32700,
            message: "Parse error"
          }));
          res.end();
        }
      });
      return;
    }
  }

  res.status(404).json({ error: "Not found" });
};
