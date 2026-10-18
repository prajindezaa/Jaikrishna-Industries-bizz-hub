/**
 * Jaikrishna Industries — Phase 4A Push Foundation & Device Registration Tests
 * Run directly via tsx (matching project standard)
 */

import {
  detectPlatform,
  detectBrowser,
  getOrCreateDeviceId,
  isPushSupported,
} from './fcm';

export function runFcmUnitTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
  }

  // Test 1: Device ID generation & caching
  try {
    const id1 = getOrCreateDeviceId();
    assert(typeof id1 === 'string' && id1.startsWith('dev_'), 'DeviceId must start with dev_');
    const id2 = getOrCreateDeviceId();
    assert(id1 === id2, 'DeviceId must be persistent across repeated calls');
    results.push({ name: 'Test 1: Stable device ID generation & persistence', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 1: Stable device ID generation & persistence', passed: false, error: err.message });
  }

  // Test 2: Platform detection
  try {
    const platform = detectPlatform();
    const validPlatforms = ['android', 'ios', 'windows', 'macos', 'linux', 'unknown'];
    assert(validPlatforms.includes(platform), `Invalid platform returned: ${platform}`);
    results.push({ name: 'Test 2: Robust client platform detection', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 2: Robust client platform detection', passed: false, error: err.message });
  }

  // Test 3: Browser detection
  try {
    const browser = detectBrowser();
    const validBrowsers = ['chrome', 'edge', 'firefox', 'safari', 'samsung', 'opera', 'unknown'];
    assert(validBrowsers.includes(browser), `Invalid browser returned: ${browser}`);
    results.push({ name: 'Test 3: Browser engine detection', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 3: Browser engine detection', passed: false, error: err.message });
  }

  // Test 4: Push Support check
  try {
    const supported = isPushSupported();
    assert(typeof supported === 'boolean', 'Push support check must return boolean');
    results.push({ name: 'Test 4: Push notification support capability check', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 4: Push notification support capability check', passed: false, error: err.message });
  }

  console.log('\n--- FCM Unit Test Results ---');
  let passedCount = 0;
  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`[PASS] ${r.name}`);
    } else {
      console.log(`[FAIL] ${r.name}: ${r.error}`);
    }
  }
  console.log(`Summary: ${passedCount}/${results.length} tests passed.\n`);

  if (passedCount !== results.length) {
    throw new Error('Some FCM tests failed');
  }
}

// Auto-run if executed directly via tsx
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.includes('fcm.test')) {
  runFcmUnitTests();
}
