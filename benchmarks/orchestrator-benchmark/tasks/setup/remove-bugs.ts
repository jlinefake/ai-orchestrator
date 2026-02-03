#!/usr/bin/env npx ts-node

/**
 * Bug Remover - Removes synthetic bugs injected for KA-4 benchmark task
 *
 * Usage:
 *   npx ts-node remove-bugs.ts
 *
 * This is a convenience wrapper around inject-bugs.ts --remove
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(import.meta.dirname, '../../../..');

interface BugDefinition {
  id: string;
  file: string;
  description: string;
  originalCode: string;
  buggyCode: string;
}

// Must match inject-bugs.ts
const BUGS: BugDefinition[] = [
  {
    id: 'BUG-001',
    file: 'src/main/orchestration/orchestration-handler.ts',
    description: 'Off-by-one error in child ownership check',
    originalCode: 'if (!ctx.childrenIds.includes(command.childId)) {',
    buggyCode: '// BUG: Off-by-one error - indexOf > 0 misses first child\n    if (ctx.childrenIds.indexOf(command.childId) > 0) {',
  },
  {
    id: 'BUG-002',
    file: 'src/main/instance/instance-orchestration.ts',
    description: 'Unsafe non-null assertion on potentially undefined value',
    originalCode: 'const child = this.deps.getInstance(command.childId);',
    buggyCode: '// BUG: Unsafe assertion - getInstance can return undefined\n        const child = this.deps.getInstance(command.childId)!;',
  },
  {
    id: 'BUG-003',
    file: 'src/main/instance/instance-orchestration.ts',
    description: 'Wrong timeout multiplier in fast-path search',
    originalCode: 'const timeoutMs = options.timeoutMs ?? task.timeoutMinutes * 60 * 1000;',
    buggyCode: '// BUG: Wrong multiplier - should be 60*1000 for minutes to ms\n    const timeoutMs = options.timeoutMs ?? task.timeoutMinutes * 1000;',
  },
];

function isBugInjected(bug: BugDefinition): boolean {
  const filePath = join(PROJECT_ROOT, bug.file);
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  return content.includes(bug.buggyCode);
}

function removeBug(bug: BugDefinition): boolean {
  const filePath = join(PROJECT_ROOT, bug.file);
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  if (!content.includes(bug.buggyCode)) return false;

  const newContent = content.replace(bug.buggyCode, bug.originalCode);
  writeFileSync(filePath, newContent);
  return true;
}

console.log('Removing injected bugs...\n');

let removed = 0;
let notFound = 0;

for (const bug of BUGS) {
  console.log(`  ${bug.id}: ${bug.description}`);

  if (!isBugInjected(bug)) {
    console.log(`    Not injected, skipping\n`);
    notFound++;
    continue;
  }

  if (removeBug(bug)) {
    console.log(`    ✅ Removed from ${bug.file}\n`);
    removed++;
  } else {
    console.log(`    ❌ Failed to remove\n`);
  }
}

console.log(`\nSummary: ${removed} removed, ${notFound} not found`);

if (removed > 0) {
  console.log('\n✅ All bugs have been cleaned up.');
}
