#!/usr/bin/env node

/**
 * Test script to diagnose profile API issues
 * Usage: node scripts/test-profile-api.mjs
 * 
 * This script tests the profile API endpoints to help diagnose issues
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testEndpoint(path, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   URL: ${BASE_URL}${path}`);
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('content-type');
    let body;
    
    if (contentType?.includes('application/json')) {
      body = await response.json();
      console.log(`   Response:`, JSON.stringify(body, null, 2));
    } else {
      body = await response.text();
      console.log(`   Response (text):`, body.substring(0, 200));
    }
    
    return { success: response.ok, status: response.status, body };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Profile API Diagnostic Tool');
  console.log('================================\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Note: Some endpoints require authentication and will return 401 if not logged in.\n`);
  
  // Test health check or root
  await testEndpoint('/', 'Root endpoint');
  
  // Test profile summary (should return 401 without auth)
  await testEndpoint('/api/profile/summary', 'Profile Summary API (expect 401 without auth)');
  
  // Test debug endpoint (should return 401 without auth)
  await testEndpoint('/api/profile/debug-summary', 'Debug Summary API (expect 401 without auth)');
  
  console.log('\n✅ Diagnostic complete!');
  console.log('\nNext steps:');
  console.log('1. If you see "Network error" or connection refused:');
  console.log('   - Make sure the dev server is running: npm run dev');
  console.log('2. If endpoints return 401:');
  console.log('   - This is expected when not logged in');
  console.log('   - Log in to the app and check browser console for detailed errors');
  console.log('3. If endpoints return 500:');
  console.log('   - Check server console logs for detailed error messages');
  console.log('   - Database tables may be missing - check Supabase');
}

main().catch(console.error);
