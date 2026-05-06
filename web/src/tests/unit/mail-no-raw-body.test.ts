/**
 * Self-check (R6): the mail-analysis surface code MUST NOT contain any path
 * that renders, fetches, or downloads raw mail body. Backend contract has
 * `rawBodyStored: false` and `bodySha256` is the only allowed body marker.
 *
 * This test is a static grep over the feature folder. If any future change
 * tries to introduce a `rawBody` field or a "download body" action, this test
 * surfaces the regression at unit-test time rather than at review time.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FEATURE_ROOT = path.resolve(__dirname, '../../features/mails');

function listFilesRecursive(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      result.push(...listFilesRecursive(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      result.push(full);
    }
  }
  return result;
}

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\brawBody\b/, // raw body field reference
  /\bdownload[- ]?body\b/i,
  /\brender[- ]?raw[- ]?body\b/i,
  /\bmessage[- ]?body[- ]?text\b/i,
];

describe('mail surface — raw body display self-check', () => {
  it('contains no forbidden raw-body identifiers in feature source', () => {
    const offenders: Array<{ file: string; pattern: string }> = [];
    for (const file of listFilesRecursive(FEATURE_ROOT)) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push({ file, pattern: String(pattern) });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
