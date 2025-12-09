#!/usr/bin/env node

/**
 * Test Cloudflare Health Check Endpoint
 *
 * Usage:
 *   npm run test:cloudflare-health
 *   npx tsx scripts/test-cloudflare-health-check.ts
 *   npx tsx scripts/test-cloudflare-health-check.ts https://your-domain.com
 */

const DEFAULT_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';
const HEALTH_CHECK_PATH = '/api/health/cloudflare';

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version?: string;
  environment?: string;
  message?: string;
}

async function testHealthCheck(baseUrl: string): Promise<void> {
  const url = new URL(HEALTH_CHECK_PATH, baseUrl);
  
  console.log('🏥 Testing Cloudflare Health Check Endpoint');
  console.log('━'.repeat(50));
  console.log(`📍 URL: ${url.toString()}`);
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Health-Check-Test/1.0',
        'CF-Ray': 'test-ray-123456-LAX',
      },
    });

    const data = (await response.json()) as HealthCheckResponse;
    const statusCode = response.status;

    console.log(`✅ Response Status: ${statusCode}`);
    console.log('');
    console.log('📊 Response Headers:');
    console.log(`  Cache-Control: ${response.headers.get('cache-control')}`);
    console.log(`  Content-Type: ${response.headers.get('content-type')}`);
    console.log(`  X-Content-Type-Options: ${response.headers.get('x-content-type-options')}`);
    console.log(`  X-Frame-Options: ${response.headers.get('x-frame-options')}`);
    console.log('');
    console.log('📋 Response Body:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // Validation
    console.log('✓ Validation Results:');
    const checks = [
      {
        name: 'Status Code is 200',
        passed: statusCode === 200,
      },
      {
        name: 'Response has status field',
        passed: data.status !== undefined,
      },
      {
        name: 'Status is "ok"',
        passed: data.status === 'ok',
      },
      {
        name: 'Response has timestamp',
        passed: data.timestamp !== undefined,
      },
      {
        name: 'Timestamp is valid ISO string',
        passed: !isNaN(new Date(data.timestamp).getTime()),
      },
      {
        name: 'Cache-Control header is set',
        passed: response.headers.get('cache-control') !== null,
      },
      {
        name: 'Security headers present',
        passed: response.headers.get('x-content-type-options') !== null,
      },
    ];

    checks.forEach((check) => {
      const icon = check.passed ? '✅' : '❌';
      console.log(`  ${icon} ${check.name}`);
    });

    const allPassed = checks.every((check) => check.passed);
    console.log('');
    console.log(allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed');
    console.log('━'.repeat(50));

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error testing health check:');
    console.error(error instanceof Error ? error.message : String(error));
    console.log('');
    console.log('💡 Tips:');
    console.log('  1. Make sure the app is running: npm run dev');
    console.log('  2. Check the URL is correct');
    console.log('  3. Verify network connectivity');
    console.log('━'.repeat(50));
    process.exit(1);
  }
}

// Get URL from command line or use default
const url = process.argv[2] || DEFAULT_URL;
testHealthCheck(url);

