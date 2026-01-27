/**
 * Hook Script Module
 *
 * Script execution for hooks.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type {
  EnhancedHookConfig,
  HookExecutionContext,
  HookExecutionResult
} from './hook-types';
import { interpolateString, isScriptAllowed } from './hook-utils';
import { executeCommand } from './hook-command';

/**
 * Execute a script hook.
 */
export async function executeScript(
  hook: EnhancedHookConfig,
  context: HookExecutionContext,
  allowedExecutableDirs: string[],
  allowedScriptDirs: string[],
  activeProcesses: Map<string, ChildProcess>,
  emitter: EventEmitter
): Promise<HookExecutionResult> {
  const handler = hook.handler;
  if (!handler.allowScript) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: hook.blocking ? 'block' : 'skip',
      error:
        'Script execution is disabled for hooks. Set allowScript: true to enable.',
      duration: 0,
      timestamp: Date.now()
    };
  }

  const scriptPath = interpolateString(
    handler.scriptPath || '',
    context
  );
  const cwd =
    handler.workingDirectory || context.workingDirectory || process.cwd();
  const resolvedScriptPath = path.resolve(cwd, scriptPath);

  if (!fs.existsSync(resolvedScriptPath)) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: hook.blocking ? 'block' : 'skip',
      error: `Script not found: ${resolvedScriptPath}`,
      duration: 0,
      timestamp: Date.now()
    };
  }

  if (
    !isScriptAllowed(resolvedScriptPath, handler.allowedScriptDirs, allowedScriptDirs, cwd)
  ) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: hook.blocking ? 'block' : 'skip',
      error: `Script path not allowed: ${resolvedScriptPath}`,
      duration: 0,
      timestamp: Date.now()
    };
  }

  // Determine script type by extension
  const ext = path.extname(scriptPath).toLowerCase();
  let interpreter: string;

  switch (ext) {
    case '.js':
      interpreter = 'node';
      break;
    case '.py':
      interpreter = 'python3';
      break;
    case '.rb':
      interpreter = 'ruby';
      break;
    case '.sh':
      interpreter = '/bin/bash';
      break;
    case '.ps1':
      interpreter = 'powershell';
      break;
    default:
      interpreter = '/bin/bash';
  }

  // Execute as command with interpreter
  const commandHook: EnhancedHookConfig = {
    ...hook,
    handler: {
      ...handler,
      type: 'command',
      command: `${interpreter} "${resolvedScriptPath}"`,
      allowShell: false
    }
  };

  return executeCommand(
    commandHook,
    context,
    allowedExecutableDirs,
    activeProcesses,
    emitter
  );
}
