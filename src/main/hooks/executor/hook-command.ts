/**
 * Hook Command Module
 *
 * Command execution for hooks.
 */

import { spawn, ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type {
  EnhancedHookConfig,
  HookExecutionContext,
  HookExecutionResult
} from './hook-types';
import {
  DEFAULT_TIMEOUT,
  MAX_OUTPUT_SIZE,
  SHELL_METACHAR_PATTERN
} from './hook-types';
import {
  interpolateString,
  parseCommand,
  resolveExecutable,
  isExecutableAllowed,
  parseBlockingResult
} from './hook-utils';

/**
 * Execute a command hook.
 */
export async function executeCommand(
  hook: EnhancedHookConfig,
  context: HookExecutionContext,
  allowedExecutableDirs: string[],
  activeProcesses: Map<string, ChildProcess>,
  emitter: EventEmitter
): Promise<HookExecutionResult> {
  const startTime = Date.now();
  const handler = hook.handler;
  const command = interpolateString(handler.command || '', context, {
    escapeShell: true
  });
  const timeout = hook.timeout || DEFAULT_TIMEOUT;

  if (context.dryRun) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: true,
      action: 'allow',
      output: `[DRY RUN] Would execute: ${command}`,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  if (!command.trim()) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: 'Empty command',
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  const containsShellMetachars = SHELL_METACHAR_PATTERN.test(command);
  if (containsShellMetachars && !handler.allowShell) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: hook.blocking ? 'block' : 'skip',
      error:
        'Shell features are disabled for hooks. Set allowShell: true to enable.',
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  const cwd =
    handler.workingDirectory || context.workingDirectory || process.cwd();
  const env = { ...process.env, ...context.env, ...handler.env };

  if (!containsShellMetachars) {
    const parsed = parseCommand(command);
    if (!parsed) {
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        action: 'skip',
        error: 'Failed to parse command',
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }

    const resolvedExecutable = resolveExecutable(parsed.command, cwd);
    if (!resolvedExecutable) {
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        action: hook.blocking ? 'block' : 'skip',
        error: `Executable not found: ${parsed.command}`,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }

    if (
      !isExecutableAllowed(
        resolvedExecutable,
        handler.allowedExecutables,
        allowedExecutableDirs
      )
    ) {
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        action: hook.blocking ? 'block' : 'skip',
        error: `Executable not allowed: ${resolvedExecutable}`,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }

    return executeProcess(
      hook,
      resolvedExecutable,
      parsed.args,
      cwd,
      env,
      timeout,
      startTime,
      activeProcesses,
      emitter
    );
  }

  // Shell execution
  return executeShellProcess(
    hook,
    command,
    cwd,
    env,
    timeout,
    startTime,
    activeProcesses,
    emitter
  );
}

/**
 * Execute a direct process (no shell).
 */
function executeProcess(
  hook: EnhancedHookConfig,
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeout: number,
  startTime: number,
  activeProcesses: Map<string, ChildProcess>,
  emitter: EventEmitter
): Promise<HookExecutionResult> {
  return new Promise<HookExecutionResult>((resolve) => {
    let output = '';
    let errorOutput = '';
    let timedOut = false;
    const streamChunks: string[] = [];
    const handler = hook.handler;

    const proc = spawn(executable, args, { cwd, env });

    activeProcesses.set(hook.id, proc);

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length <= MAX_OUTPUT_SIZE) {
        output += chunk;
      }
      if (handler.streamOutput) {
        streamChunks.push(chunk);
        emitter.emit('hook-output', {
          hookId: hook.id,
          chunk,
          stream: 'stdout'
        });
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (errorOutput.length + chunk.length <= MAX_OUTPUT_SIZE) {
        errorOutput += chunk;
      }
      if (handler.streamOutput) {
        streamChunks.push(chunk);
        emitter.emit('hook-output', {
          hookId: hook.id,
          chunk,
          stream: 'stderr'
        });
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      activeProcesses.delete(hook.id);

      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          hookId: hook.id,
          hookName: hook.name,
          success: false,
          action: 'skip',
          error: `Command timed out after ${timeout}ms`,
          output,
          duration,
          timestamp: startTime,
          streamChunks: handler.streamOutput ? streamChunks : undefined
        });
        return;
      }

      const { action, blockReason, modifiedData } = parseBlockingResult(
        output,
        errorOutput,
        code,
        hook.blocking || false
      );

      resolve({
        hookId: hook.id,
        hookName: hook.name,
        success: code === 0 || action === 'allow',
        action,
        output,
        error: code !== 0 ? errorOutput || `Exit code ${code}` : undefined,
        duration,
        timestamp: startTime,
        blockReason,
        modifiedData,
        streamChunks: handler.streamOutput ? streamChunks : undefined
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      activeProcesses.delete(hook.id);

      resolve({
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        action: 'skip',
        error: `Failed to execute: ${err.message}`,
        duration: Date.now() - startTime,
        timestamp: startTime
      });
    });
  });
}

/**
 * Execute a command via shell.
 */
function executeShellProcess(
  hook: EnhancedHookConfig,
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeout: number,
  startTime: number,
  activeProcesses: Map<string, ChildProcess>,
  emitter: EventEmitter
): Promise<HookExecutionResult> {
  return new Promise<HookExecutionResult>((resolve) => {
    let output = '';
    let errorOutput = '';
    let timedOut = false;
    const streamChunks: string[] = [];
    const handler = hook.handler;

    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs =
      process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, { cwd, env });

    activeProcesses.set(hook.id, proc);

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length <= MAX_OUTPUT_SIZE) {
        output += chunk;
      }
      if (handler.streamOutput) {
        streamChunks.push(chunk);
        emitter.emit('hook-output', {
          hookId: hook.id,
          chunk,
          stream: 'stdout'
        });
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (errorOutput.length + chunk.length <= MAX_OUTPUT_SIZE) {
        errorOutput += chunk;
      }
      if (handler.streamOutput) {
        streamChunks.push(chunk);
        emitter.emit('hook-output', {
          hookId: hook.id,
          chunk,
          stream: 'stderr'
        });
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      activeProcesses.delete(hook.id);

      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          hookId: hook.id,
          hookName: hook.name,
          success: false,
          action: 'skip',
          error: `Command timed out after ${timeout}ms`,
          output,
          duration,
          timestamp: startTime,
          streamChunks: handler.streamOutput ? streamChunks : undefined
        });
        return;
      }

      const { action, blockReason, modifiedData } = parseBlockingResult(
        output,
        errorOutput,
        code,
        hook.blocking || false
      );

      resolve({
        hookId: hook.id,
        hookName: hook.name,
        success: code === 0 || action === 'allow',
        action,
        output,
        error: code !== 0 ? errorOutput || `Exit code ${code}` : undefined,
        duration,
        timestamp: startTime,
        blockReason,
        modifiedData,
        streamChunks: handler.streamOutput ? streamChunks : undefined
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      activeProcesses.delete(hook.id);

      resolve({
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        action: 'skip',
        error: `Failed to execute: ${err.message}`,
        duration: Date.now() - startTime,
        timestamp: startTime
      });
    });
  });
}
