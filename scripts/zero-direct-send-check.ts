/**
 * Jaikrishna Industries — Zero-Direct-Send Static Analysis Scan
 * Scans all client files (src/) to verify:
 * 1. No direct collection('notifications').add / set from client code.
 * 2. No direct FCM/messaging send calls from client code.
 * 3. Only the unified router (notification_router.ts) dispatches notifications.
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const BANNED_PATTERNS = [
  /collection\s*\(\s*db\s*,\s*['"]notifications['"]\s*\)\s*\.\s*(add|set)/,
  /collection\s*\(\s*['"]notifications['"]\s*\)\s*\.\s*(add|set)/,
  /messaging\s*\(\s*\)\s*\.\s*send/,
];

function scanDirectory(dir: string): { file: string; line: number; match: string }[] {
  const violations: { file: string; line: number; match: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of BANNED_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: idx + 1,
              match: line.trim(),
            });
          }
        }
      });
    }
  }
  return violations;
}

export function runZeroDirectSendAudit() {
  console.log('🔍 Running Zero-Direct-Send Static Linter Audit...');
  const violations = scanDirectory(SRC_DIR);

  if (violations.length > 0) {
    console.error(`❌ FAILED: Found ${violations.length} forbidden direct notification writes in client:`);
    violations.forEach((v) => console.error(`  - ${v.file}:${v.line} -> ${v.match}`));
    throw new Error('Zero-Direct-Send violation detected in client code!');
  }

  console.log('✅ PASSED: 0 direct notification writes or FCM calls found in src/. Client code strictly adheres to Rule 1.');
}

if (process.argv[1] && process.argv[1].endsWith('zero-direct-send-check.ts')) {
  try {
    runZeroDirectSendAudit();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
