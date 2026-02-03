#!/usr/bin/env npx ts-node

/**
 * Ground Truth Generator - Computes correct answers for known-answer benchmark tasks
 *
 * This script analyzes the actual codebase to determine the ground truth
 * that benchmark outputs will be compared against.
 *
 * Usage:
 *   npx ts-node ground-truth.ts           # Generate all ground truths
 *   npx ts-node ground-truth.ts KA-1      # Generate specific task
 *   npx ts-node ground-truth.ts --verify  # Verify current ground truth is up to date
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const PROJECT_ROOT = join(import.meta.dirname, '../../../..');
const GROUND_TRUTH_PATH = join(import.meta.dirname, 'ground-truth.json');

interface GroundTruth {
  generatedAt: string;
  projectRoot: string;
  tasks: {
    'KA-1': KA1GroundTruth;
    'KA-2': KA2GroundTruth;
    'KA-3': KA3GroundTruth;
    'KA-4': KA4GroundTruth;
    'KA-5': KA5GroundTruth;
  };
}

// KA-1: Find all IPC handlers
interface KA1GroundTruth {
  description: string;
  totalCount: number;
  handlers: Array<{
    channel: string;
    file: string;
    line: number;
    type: 'handle' | 'on';
  }>;
}

// KA-2: List singleton services
interface KA2GroundTruth {
  description: string;
  totalCount: number;
  singletons: Array<{
    className: string;
    file: string;
    line: number;
    hasResetForTesting: boolean;
  }>;
}

// KA-3: Files importing orchestration-handler
interface KA3GroundTruth {
  description: string;
  totalCount: number;
  importingFiles: Array<{
    file: string;
    line: number;
    importStatement: string;
  }>;
}

// KA-4: Injected bugs
interface KA4GroundTruth {
  description: string;
  totalCount: number;
  bugs: Array<{
    id: string;
    file: string;
    line: number;
    description: string;
    originalCode: string;
    buggyCode: string;
  }>;
}

// KA-5: Message trace path
interface KA5GroundTruth {
  description: string;
  tracePath: Array<{
    step: number;
    file: string;
    function: string;
    description: string;
  }>;
  keyFiles: string[];
}

/**
 * Walk directory recursively, yielding TypeScript files
 */
function* walkTs(dir: string): Generator<string> {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          yield* walkTs(fullPath);
        } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
          yield fullPath;
        }
      } catch {
        // Skip inaccessible
      }
    }
  } catch {
    // Skip inaccessible
  }
}

/**
 * KA-1: Find all IPC handlers in the codebase
 */
function generateKA1(): KA1GroundTruth {
  const handlers: KA1GroundTruth['handlers'] = [];

  // Patterns for IPC handlers
  const handlePattern = /ipcMain\.handle\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const onPattern = /ipcMain\.on\s*\(\s*['"`]([^'"`]+)['"`]/g;

  for (const filePath of walkTs(join(PROJECT_ROOT, 'src'))) {
    const content = readFileSync(filePath, 'utf-8');
    const relPath = relative(PROJECT_ROOT, filePath);

    // Find ipcMain.handle calls
    let match;
    while ((match = handlePattern.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      handlers.push({
        channel: match[1],
        file: relPath,
        line: lineNum,
        type: 'handle',
      });
    }

    // Find ipcMain.on calls
    while ((match = onPattern.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      handlers.push({
        channel: match[1],
        file: relPath,
        line: lineNum,
        type: 'on',
      });
    }
  }

  // Sort by file then line
  handlers.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  return {
    description: 'All IPC handlers registered with ipcMain.handle() or ipcMain.on()',
    totalCount: handlers.length,
    handlers,
  };
}

/**
 * KA-2: List all singleton services with getInstance()
 */
function generateKA2(): KA2GroundTruth {
  const singletons: KA2GroundTruth['singletons'] = [];

  // Pattern for singleton getInstance pattern
  const singletonPattern = /static\s+getInstance\s*\(\s*\)/g;
  const classPattern = /(?:export\s+)?class\s+(\w+)/g;
  const resetPattern = /_resetForTesting/;

  for (const filePath of walkTs(join(PROJECT_ROOT, 'src'))) {
    const content = readFileSync(filePath, 'utf-8');
    const relPath = relative(PROJECT_ROOT, filePath);

    // Check if file has getInstance
    if (!singletonPattern.test(content)) continue;
    singletonPattern.lastIndex = 0; // Reset regex

    // Find the class name
    const classMatch = classPattern.exec(content);
    if (!classMatch) continue;

    // Find line number of getInstance
    const getInstanceMatch = singletonPattern.exec(content);
    if (!getInstanceMatch) continue;

    const lineNum = content.slice(0, getInstanceMatch.index).split('\n').length;

    singletons.push({
      className: classMatch[1],
      file: relPath,
      line: lineNum,
      hasResetForTesting: resetPattern.test(content),
    });
  }

  // Sort by class name
  singletons.sort((a, b) => a.className.localeCompare(b.className));

  return {
    description: 'All classes implementing singleton pattern with static getInstance()',
    totalCount: singletons.length,
    singletons,
  };
}

/**
 * KA-3: Find files importing from orchestration-handler.ts
 */
function generateKA3(): KA3GroundTruth {
  const importingFiles: KA3GroundTruth['importingFiles'] = [];

  // Patterns for imports
  const importPatterns = [
    /import\s+.*from\s+['"`].*orchestration-handler['"`]/g,
    /import\s+.*from\s+['"`].*orchestration-handler\.js['"`]/g,
    /require\s*\(\s*['"`].*orchestration-handler['"`]\s*\)/g,
  ];

  for (const filePath of walkTs(join(PROJECT_ROOT, 'src'))) {
    // Skip the file itself
    if (filePath.endsWith('orchestration-handler.ts')) continue;

    const content = readFileSync(filePath, 'utf-8');
    const relPath = relative(PROJECT_ROOT, filePath);

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        importingFiles.push({
          file: relPath,
          line: lineNum,
          importStatement: match[0].trim(),
        });
      }
      pattern.lastIndex = 0; // Reset
    }
  }

  // Sort by file
  importingFiles.sort((a, b) => a.file.localeCompare(b.file));

  return {
    description: 'All files that import from orchestration-handler.ts',
    totalCount: importingFiles.length,
    importingFiles,
  };
}

/**
 * KA-4: Define bugs to inject (these are synthetic, not actual bugs)
 */
function generateKA4(): KA4GroundTruth {
  // These are predefined bugs we'll inject for testing
  return {
    description: 'Synthetic bugs injected for benchmark testing',
    totalCount: 3,
    bugs: [
      {
        id: 'BUG-001',
        file: 'src/main/orchestration/orchestration-handler.ts',
        line: 0, // Will be determined during injection
        description: 'Off-by-one error in child count check',
        originalCode: 'if (!ctx.childrenIds.includes(command.childId))',
        buggyCode: '// BUG: Off-by-one error - should use includes not indexOf\nif (ctx.childrenIds.indexOf(command.childId) > 0)',
      },
      {
        id: 'BUG-002',
        file: 'src/main/instance/instance-orchestration.ts',
        line: 0,
        description: 'Missing null check before accessing property',
        originalCode: 'const child = this.deps.getInstance(command.childId);',
        buggyCode: '// BUG: Missing null check - child could be undefined\nconst child = this.deps.getInstance(command.childId)!;',
      },
      {
        id: 'BUG-003',
        file: 'src/main/routing/model-router.ts',
        line: 0,
        description: 'Wrong comparison operator in complexity check',
        originalCode: 'if (score >= this.config.complexityThreshold)',
        buggyCode: '// BUG: Should be >= not > for threshold comparison\nif (score > this.config.complexityThreshold)',
      },
    ],
  };
}

/**
 * KA-5: Document the expected trace path from UI to child spawn
 */
function generateKA5(): KA5GroundTruth {
  return {
    description: 'Trace path from user sending message to child instance being spawned',
    tracePath: [
      {
        step: 1,
        file: 'src/renderer/app/features/chat/chat.component.ts',
        function: 'sendMessage()',
        description: 'User types message and clicks send in the chat UI',
      },
      {
        step: 2,
        file: 'src/renderer/app/core/services/instance.service.ts',
        function: 'sendInput()',
        description: 'Angular service calls Electron IPC to send message',
      },
      {
        step: 3,
        file: 'src/preload/preload.ts',
        function: 'electronAPI.sendInput()',
        description: 'Preload script bridges renderer to main process via contextBridge',
      },
      {
        step: 4,
        file: 'src/main/ipc/instance-handlers.ts',
        function: 'ipcMain.handle(INSTANCE_SEND_INPUT)',
        description: 'Main process IPC handler receives the message',
      },
      {
        step: 5,
        file: 'src/main/instance/instance-manager.ts',
        function: 'sendInput()',
        description: 'Instance manager forwards to the CLI adapter',
      },
      {
        step: 6,
        file: 'src/main/cli/adapters/claude-cli-adapter.ts',
        function: 'sendInput()',
        description: 'CLI adapter sends input to Claude process stdin',
      },
      {
        step: 7,
        file: 'src/main/cli/adapters/claude-cli-adapter.ts',
        function: 'handleOutput()',
        description: 'Claude responds with orchestrator command in output',
      },
      {
        step: 8,
        file: 'src/main/instance/instance-manager.ts',
        function: 'processOutput()',
        description: 'Output is processed, orchestration commands detected',
      },
      {
        step: 9,
        file: 'src/main/instance/instance-orchestration.ts',
        function: 'processOrchestrationOutput()',
        description: 'Orchestration manager parses spawn_child command',
      },
      {
        step: 10,
        file: 'src/main/orchestration/orchestration-handler.ts',
        function: 'handleSpawnChild()',
        description: 'Orchestration handler emits spawn-child event',
      },
      {
        step: 11,
        file: 'src/main/instance/instance-orchestration.ts',
        function: 'on(spawn-child)',
        description: 'Event listener creates the child instance',
      },
      {
        step: 12,
        file: 'src/main/instance/instance-manager.ts',
        function: 'createChildInstance()',
        description: 'Child instance is created with task and parent reference',
      },
    ],
    keyFiles: [
      'src/renderer/app/features/chat/',
      'src/preload/preload.ts',
      'src/main/ipc/instance-handlers.ts',
      'src/main/instance/instance-manager.ts',
      'src/main/instance/instance-orchestration.ts',
      'src/main/orchestration/orchestration-handler.ts',
      'src/main/cli/adapters/claude-cli-adapter.ts',
    ],
  };
}

/**
 * Generate all ground truths
 */
function generateAll(): GroundTruth {
  console.log('Generating ground truth for benchmark tasks...\n');

  console.log('KA-1: Finding IPC handlers...');
  const ka1 = generateKA1();
  console.log(`  Found ${ka1.totalCount} handlers\n`);

  console.log('KA-2: Finding singleton services...');
  const ka2 = generateKA2();
  console.log(`  Found ${ka2.totalCount} singletons\n`);

  console.log('KA-3: Finding orchestration-handler imports...');
  const ka3 = generateKA3();
  console.log(`  Found ${ka3.totalCount} importing files\n`);

  console.log('KA-4: Defining injectable bugs...');
  const ka4 = generateKA4();
  console.log(`  Defined ${ka4.totalCount} bugs\n`);

  console.log('KA-5: Documenting trace path...');
  const ka5 = generateKA5();
  console.log(`  Documented ${ka5.tracePath.length} steps\n`);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    tasks: {
      'KA-1': ka1,
      'KA-2': ka2,
      'KA-3': ka3,
      'KA-4': ka4,
      'KA-5': ka5,
    },
  };
}

/**
 * Save ground truth to file
 */
function save(groundTruth: GroundTruth): void {
  writeFileSync(GROUND_TRUTH_PATH, JSON.stringify(groundTruth, null, 2));
  console.log(`Ground truth saved to: ${GROUND_TRUTH_PATH}`);
}

/**
 * Load existing ground truth
 */
function load(): GroundTruth | null {
  if (!existsSync(GROUND_TRUTH_PATH)) return null;
  try {
    return JSON.parse(readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Print summary of ground truth
 */
function printSummary(gt: GroundTruth): void {
  console.log('\n=== Ground Truth Summary ===\n');
  console.log(`Generated: ${gt.generatedAt}`);
  console.log(`Project: ${gt.projectRoot}\n`);

  console.log('KA-1 (IPC Handlers):');
  console.log(`  Total: ${gt.tasks['KA-1'].totalCount}`);
  console.log(`  Files: ${[...new Set(gt.tasks['KA-1'].handlers.map(h => h.file))].length}`);

  console.log('\nKA-2 (Singletons):');
  console.log(`  Total: ${gt.tasks['KA-2'].totalCount}`);
  const withReset = gt.tasks['KA-2'].singletons.filter(s => s.hasResetForTesting).length;
  console.log(`  With _resetForTesting: ${withReset}/${gt.tasks['KA-2'].totalCount}`);

  console.log('\nKA-3 (Orchestration-handler imports):');
  console.log(`  Total: ${gt.tasks['KA-3'].totalCount}`);

  console.log('\nKA-4 (Injectable bugs):');
  console.log(`  Total: ${gt.tasks['KA-4'].totalCount}`);

  console.log('\nKA-5 (Trace path):');
  console.log(`  Steps: ${gt.tasks['KA-5'].tracePath.length}`);
  console.log(`  Key files: ${gt.tasks['KA-5'].keyFiles.length}`);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--verify')) {
  const existing = load();
  if (!existing) {
    console.log('No existing ground truth found.');
    process.exit(1);
  }

  const fresh = generateAll();

  // Compare counts
  let differences = 0;
  if (existing.tasks['KA-1'].totalCount !== fresh.tasks['KA-1'].totalCount) {
    console.log(`KA-1: Count changed ${existing.tasks['KA-1'].totalCount} -> ${fresh.tasks['KA-1'].totalCount}`);
    differences++;
  }
  if (existing.tasks['KA-2'].totalCount !== fresh.tasks['KA-2'].totalCount) {
    console.log(`KA-2: Count changed ${existing.tasks['KA-2'].totalCount} -> ${fresh.tasks['KA-2'].totalCount}`);
    differences++;
  }
  if (existing.tasks['KA-3'].totalCount !== fresh.tasks['KA-3'].totalCount) {
    console.log(`KA-3: Count changed ${existing.tasks['KA-3'].totalCount} -> ${fresh.tasks['KA-3'].totalCount}`);
    differences++;
  }

  if (differences === 0) {
    console.log('Ground truth is up to date.');
  } else {
    console.log(`\n${differences} task(s) have changed. Run without --verify to update.`);
    process.exit(1);
  }
} else {
  const groundTruth = generateAll();
  save(groundTruth);
  printSummary(groundTruth);
}
