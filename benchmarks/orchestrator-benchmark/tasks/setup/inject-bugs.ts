#!/usr/bin/env npx ts-node

/**
 * Bug Injector - Injects synthetic bugs for KA-4 benchmark task
 *
 * Usage:
 *   npx ts-node inject-bugs.ts          # Inject all bugs
 *   npx ts-node inject-bugs.ts --status # Check if bugs are injected
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

/**
 * Check if a bug is currently injected in a file
 */
function isBugInjected(bug: BugDefinition): boolean {
  const filePath = join(PROJECT_ROOT, bug.file);
  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath, 'utf-8');
  return content.includes(`// BUG:`);
}

/**
 * Inject a bug into a file
 */
function injectBug(bug: BugDefinition): boolean {
  const filePath = join(PROJECT_ROOT, bug.file);
  if (!existsSync(filePath)) {
    console.error(`  File not found: ${bug.file}`);
    return false;
  }

  const content = readFileSync(filePath, 'utf-8');

  if (!content.includes(bug.originalCode)) {
    console.error(`  Original code not found in ${bug.file}`);
    console.error(`  Looking for: ${bug.originalCode.slice(0, 50)}...`);
    return false;
  }

  const newContent = content.replace(bug.originalCode, bug.buggyCode);
  writeFileSync(filePath, newContent);
  return true;
}

/**
 * Remove a bug from a file
 */
function removeBug(bug: BugDefinition): boolean {
  const filePath = join(PROJECT_ROOT, bug.file);
  if (!existsSync(filePath)) {
    console.error(`  File not found: ${bug.file}`);
    return false;
  }

  const content = readFileSync(filePath, 'utf-8');

  if (!content.includes(bug.buggyCode)) {
    // Bug might not be injected
    return false;
  }

  const newContent = content.replace(bug.buggyCode, bug.originalCode);
  writeFileSync(filePath, newContent);
  return true;
}

/**
 * Check status of all bugs
 */
function checkStatus(): void {
  console.log('Bug injection status:\n');

  for (const bug of BUGS) {
    const injected = isBugInjected(bug);
    const status = injected ? '🔴 INJECTED' : '🟢 Not injected';
    console.log(`  ${bug.id}: ${status}`);
    console.log(`    File: ${bug.file}`);
    console.log(`    Description: ${bug.description}`);
    console.log();
  }
}

/**
 * Inject all bugs
 */
function injectAll(): void {
  console.log('Injecting bugs for KA-4 benchmark...\n');

  let injected = 0;
  let failed = 0;

  for (const bug of BUGS) {
    console.log(`  ${bug.id}: ${bug.description}`);

    if (isBugInjected(bug)) {
      console.log(`    Already injected, skipping\n`);
      injected++;
      continue;
    }

    if (injectBug(bug)) {
      console.log(`    ✅ Injected into ${bug.file}\n`);
      injected++;
    } else {
      console.log(`    ❌ Failed to inject\n`);
      failed++;
    }
  }

  console.log(`\nSummary: ${injected} injected, ${failed} failed`);

  if (injected > 0) {
    console.log('\n⚠️  Remember to run remove-bugs.ts after benchmarking!');
  }
}

/**
 * Remove all bugs
 */
function removeAll(): void {
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
}

// Main
const args = process.argv.slice(2);

if (args.includes('--status')) {
  checkStatus();
} else if (args.includes('--remove')) {
  removeAll();
} else {
  injectAll();
}
