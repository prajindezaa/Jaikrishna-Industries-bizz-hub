/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Central Microphone Service & Permission State Machine Test Runner
 *
 * Runs via tsx without external test runner dependencies.
 * Validates:
 * 1. State transitions across Permissions API states (granted, prompt, denied)
 * 2. Proper error categorization for NotAllowedError, NotFoundError, NotReadableError, SecurityError
 * 3. Safe cleanup of all audio tracks on release
 * 4. Snooze functionality ("Not now" 7-day memory)
 * 5. Architectural rule: Zero direct calls to getUserMedia outside microphoneService.ts
 */

import { micService } from './microphoneService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestOutcome {
  id: number;
  description: string;
  passed: boolean;
  error?: string;
}

const outcomes: TestOutcome[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('JAIKRISHNA INDUSTRIES: MICROPHONE SERVICE TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Initializes without asking for permission on page load
  try {
    const state = micService.getPermissionState();
    assert(['not_asked', 'prompt', 'granted', 'blocked', 'denied'].includes(state), `Unexpected state: ${state}`);
    assert(!micService.isCapturing(), 'Microphone should not be capturing on init');
    outcomes.push({ id: 1, description: 'Initializes without asking on page load', passed: true });
    console.log('  ✓ Test 1: Initializes without asking on page load');
  } catch (err: any) {
    outcomes.push({ id: 1, description: 'Initializes without asking on page load', passed: false, error: err.message });
    console.log(`  ✗ Test 1: Failed: ${err.message}`);
  }

  // Test 2: In-app explanation snooze ("Not now" 7-day memory)
  try {
    micService.clearSnooze();
    assert(!micService.isSnoozed(), 'Snooze should be clear initially');

    micService.setSnooze(7);
    assert(micService.isSnoozed(), 'Snooze should be active after setSnooze(7)');

    micService.clearSnooze();
    assert(!micService.isSnoozed(), 'Snooze should be cleared after clearSnooze()');

    outcomes.push({ id: 2, description: 'In-app explanation snooze memory (7 days)', passed: true });
    console.log('  ✓ Test 2: In-app explanation snooze memory (7 days)');
  } catch (err: any) {
    outcomes.push({ id: 2, description: 'In-app explanation snooze memory', passed: false, error: err.message });
    console.log(`  ✗ Test 2: Failed: ${err.message}`);
  }

  // Test 3: Releases all tracks on releaseAllTracks
  try {
    let stopped = false;
    const mockTrack = {
      stop: () => {
        stopped = true;
      },
      readyState: 'live',
    };
    const mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    } as unknown as MediaStream;

    (micService as any).currentStream = mockStream;
    micService.releaseAllTracks();

    assert(stopped, 'Track stop() must be called on releaseAllTracks()');
    assert((micService as any).currentStream === null, 'currentStream must be null after release');

    outcomes.push({ id: 3, description: 'Releases all media tracks cleanly', passed: true });
    console.log('  ✓ Test 3: Releases all media tracks cleanly');
  } catch (err: any) {
    outcomes.push({ id: 3, description: 'Releases all media tracks cleanly', passed: false, error: err.message });
    console.log(`  ✗ Test 3: Failed: ${err.message}`);
  }

  // Test 4: Correctly categorizes NotAllowedError as denied
  try {
    const notAllowedError = new Error('Permission denied');
    notAllowedError.name = 'NotAllowedError';
    (micService as any).handleMediaError(notAllowedError);

    assert(micService.getPermissionState() === 'denied', 'State should be denied');
    assert(micService.getLastErrorName() === 'NotAllowedError', 'lastErrorName should match');

    outcomes.push({ id: 4, description: 'Categorizes NotAllowedError as denied', passed: true });
    console.log('  ✓ Test 4: Categorizes NotAllowedError as denied');
  } catch (err: any) {
    outcomes.push({ id: 4, description: 'Categorizes NotAllowedError as denied', passed: false, error: err.message });
    console.log(`  ✗ Test 4: Failed: ${err.message}`);
  }

  // Test 5: Correctly categorizes NotFoundError as no_device
  try {
    const notFoundError = new Error('No audio input found');
    notFoundError.name = 'NotFoundError';
    (micService as any).handleMediaError(notFoundError);

    assert(micService.getPermissionState() === 'no_device', 'State should be no_device');
    outcomes.push({ id: 5, description: 'Categorizes NotFoundError as no_device', passed: true });
    console.log('  ✓ Test 5: Categorizes NotFoundError as no_device');
  } catch (err: any) {
    outcomes.push({ id: 5, description: 'Categorizes NotFoundError as no_device', passed: false, error: err.message });
    console.log(`  ✗ Test 5: Failed: ${err.message}`);
  }

  // Test 6: Correctly categorizes NotReadableError (device busy) as busy
  try {
    const busyError = new Error('Hardware in use');
    busyError.name = 'NotReadableError';
    (micService as any).handleMediaError(busyError);

    assert(micService.getPermissionState() === 'busy', 'State should be busy');
    outcomes.push({ id: 6, description: 'Categorizes NotReadableError as busy', passed: true });
    console.log('  ✓ Test 6: Categorizes NotReadableError as busy');
  } catch (err: any) {
    outcomes.push({ id: 6, description: 'Categorizes NotReadableError as busy', passed: false, error: err.message });
    console.log(`  ✗ Test 6: Failed: ${err.message}`);
  }

  // Test 7: Correctly categorizes SecurityError as blocked
  try {
    const secError = new Error('Permissions-Policy violation');
    secError.name = 'SecurityError';
    (micService as any).handleMediaError(secError);

    assert(micService.getPermissionState() === 'blocked', 'State should be blocked');
    outcomes.push({ id: 7, description: 'Categorizes SecurityError as blocked', passed: true });
    console.log('  ✓ Test 7: Categorizes SecurityError as blocked');
  } catch (err: any) {
    outcomes.push({ id: 7, description: 'Categorizes SecurityError as blocked', passed: false, error: err.message });
    console.log(`  ✗ Test 7: Failed: ${err.message}`);
  }

  // Test 8: Architectural verification — No code outside microphoneService calls getUserMedia
  try {
    const srcDir = path.resolve(__dirname, '..');
    const allFiles: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          allFiles.push(fullPath);
        }
      }
    }

    scanDir(srcDir);

    const violatingFiles: string[] = [];
    for (const filePath of allFiles) {
      if (
        filePath.endsWith('microphoneService.ts') ||
        filePath.endsWith('microphoneService.test.ts')
      ) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes('getUserMedia') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
        ) {
          violatingFiles.push(`${path.basename(filePath)}:${i + 1}`);
        }
      }
    }

    assert(
      violatingFiles.length === 0,
      `Direct getUserMedia calls found outside microphoneService: ${violatingFiles.join(', ')}`
    );

    outcomes.push({
      id: 8,
      description: 'Architectural enforcement: Zero getUserMedia calls outside microphoneService',
      passed: true,
    });
    console.log('  ✓ Test 8: Architectural enforcement: Zero getUserMedia calls outside microphoneService');
  } catch (err: any) {
    outcomes.push({
      id: 8,
      description: 'Architectural enforcement: Zero getUserMedia calls outside microphoneService',
      passed: false,
      error: err.message,
    });
    console.log(`  ✗ Test 8: Failed: ${err.message}`);
  }

  console.log('\n------------------------------------------------------');
  const totalPassed = outcomes.filter((o) => o.passed).length;
  console.log(`RESULTS: ${totalPassed} / ${outcomes.length} tests passed`);
  console.log('------------------------------------------------------\n');

  if (totalPassed < outcomes.length) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
