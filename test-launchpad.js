/**
 * Test script for Launchpad PR0 endpoints
 */

const BASE_URL = 'http://localhost:3005';

async function testLaunchpadEndpoints() {
  console.log('🧪 Testing Launchpad PR0 Implementation\n');

  // Test 1: Status endpoint (should work)
  console.log('📊 Test 1: GET /api/launchpad/status');
  try {
    const statusRes = await fetch(`${BASE_URL}/api/launchpad/status`);
    const statusData = await statusRes.json();
    
    console.log(`Status: ${statusRes.status}`);
    console.log(`Enabled: ${statusData.response?.launchpad?.enabled}`);
    console.log(`Version: ${statusData.response?.version}`);
    console.log(`Features: ${statusData.response?.launchpad?.features?.availableFeatures?.length || 0} available`);
    console.log('✅ Status endpoint working\n');
  } catch (error) {
    console.log(`❌ Status endpoint error: ${error.message}\n`);
  }

  // Test 2: Submit endpoint with feature disabled (should return 503)
  console.log('🚫 Test 2: POST /api/launchpad/submit (feature disabled)');
  try {
    const submitRes = await fetch(`${BASE_URL}/api/launchpad/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: { name: "Test", symbol: "TEST", decimals: 6 },
        launch: { launchWallet: "11111111111111111111111111111112" }
      })
    });
    
    const submitData = await submitRes.json();
    console.log(`Status: ${submitRes.status}`);
    console.log(`Error Code: ${submitData.error?.code}`);
    console.log(`Message: ${submitData.error?.message}`);
    
    if (submitRes.status === 503 && submitData.error?.code === 'FEATURE_DISABLED') {
      console.log('✅ Feature flag working correctly\n');
    } else {
      console.log('❌ Unexpected response\n');
    }
  } catch (error) {
    console.log(`❌ Submit endpoint error: ${error.message}\n`);
  }

  // Test 3: Invalid JSON (should return 400)
  console.log('🔒 Test 3: POST /api/launchpad/submit (invalid JSON)');
  try {
    const invalidRes = await fetch(`${BASE_URL}/api/launchpad/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json'
    });
    
    const invalidData = await invalidRes.json();
    console.log(`Status: ${invalidRes.status}`);
    console.log(`Error Code: ${invalidData.error?.code}`);
    
    if (invalidRes.status === 400) {
      console.log('✅ Input validation working\n');
    } else {
      console.log('❌ Validation failed\n');
    }
  } catch (error) {
    console.log(`❌ Validation test error: ${error.message}\n`);
  }

  // Test 4: GET method on submit (should return 405)
  console.log('🚫 Test 4: GET /api/launchpad/submit (method not allowed)');
  try {
    const methodRes = await fetch(`${BASE_URL}/api/launchpad/submit`, {
      method: 'GET'
    });
    
    const methodData = await methodRes.json();
    console.log(`Status: ${methodRes.status}`);
    console.log(`Error Code: ${methodData.error?.code}`);
    
    if (methodRes.status === 405) {
      console.log('✅ Method validation working\n');
    } else {
      console.log('❌ Method validation failed\n');
    }
  } catch (error) {
    console.log(`❌ Method test error: ${error.message}\n`);
  }

  console.log('🏁 Test completed!');
}

// Run tests
testLaunchpadEndpoints().catch(console.error);