// test-session.js
// Simple test script for your session API

const fetch = require('node-fetch'); // You might need to install this

const API_URL = 'http://localhost:3000/api/mcp-session'; // Change to your Vercel URL when deployed
const SESSION_ID = 'test-session-123';

async function testAPI() {
  console.log('🧪 Testing Session-based MCP API...\n');
  
  // Test 1: Health check
  console.log('1. Testing health check...');
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'X-Session-ID': SESSION_ID
      }
    });
    const data = await response.json();
    console.log('✅ Health check passed:', data.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: List tools (should work without auth)
  console.log('\n2. Testing tools list...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      })
    });
    const data = await response.json();
    console.log('✅ Tools list:', data.result.tools.length + ' tools available');
  } catch (error) {
    console.log('❌ Tools list failed:', error.message);
  }
  
  // Test 3: Try to search contacts without auth (should fail)
  console.log('\n3. Testing search without auth (should fail)...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_contacts',
          arguments: {
            query: 'test@example.com'
          }
        },
        id: 2
      })
    });
    const data = await response.json();
    if (data.error && data.error.code === -32001) {
      console.log('✅ Correctly requires authentication');
    } else {
      console.log('❌ Should have required authentication');
    }
  } catch (error) {
    console.log('❌ Search test failed:', error.message);
  }
  
  // Test 4: Authenticate (replace with your real credentials)
  console.log('\n4. Testing authentication...');
  console.log('⚠️  Replace API_KEY and LOCATION_ID with your real values!');
  
  const YOUR_API_KEY = 'your_ghl_api_key_here'; // Replace this!
  const YOUR_LOCATION_ID = 'your_location_id_here'; // Replace this!
  
  if (YOUR_API_KEY === 'your_ghl_api_key_here') {
    console.log('⚠️  Please update the API key and location ID in test-session.js');
    console.log('   Get your API key from: GoHighLevel → Settings → Integrations → Private Integrations');
    console.log('   Get your location ID from: GoHighLevel → Settings → Company → Locations');
    return;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'authenticate',
          arguments: {
            apiKey: YOUR_API_KEY,
            locationId: YOUR_LOCATION_ID
          }
        },
        id: 3
      })
    });
    const data = await response.json();
    if (data.result) {
      console.log('✅ Authentication successful:', data.result.content[0].text);
    } else {
      console.log('❌ Authentication failed:', data.error.message);
      return;
    }
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    return;
  }
  
  // Test 5: Now try to search contacts (should work)
  console.log('\n5. Testing search with auth (should work)...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_contacts',
          arguments: {
            query: 'test',
            limit: 3
          }
        },
        id: 4
      })
    });
    const data = await response.json();
    if (data.result) {
      console.log('✅ Search successful! Found contacts');
    } else {
      console.log('❌ Search failed:', data.error.message);
    }
  } catch (error) {
    console.log('❌ Search failed:', error.message);
  }
  
  console.log('\n🎉 Testing complete!');
}

// Run the test
testAPI().catch(console.error);

// Instructions
console.log(`
📋 INSTRUCTIONS:
1. Update YOUR_API_KEY and YOUR_LOCATION_ID in this file
2. Run: node test-session.js
3. Check that all tests pass
4. If tests pass, your API is ready!

🔑 GET YOUR CREDENTIALS:
- API Key: GoHighLevel → Settings → Integrations → Private Integrations → Create Integration
- Location ID: GoHighLevel → Settings → Company → Locations (copy the ID)
`);
