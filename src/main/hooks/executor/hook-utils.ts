/**
 * Hook Utils Module
 *
 * String interpolation, command parsing, and security utilities.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { HookExecutionContext } from './hook-types';

/**
 * Interpolate variables in a string.
 */
export function interpolateString(
  str: string,
  context: HookExecutionContext,
  options: { escapeShell?: boolean } = {}
): string {
  const apply = (value: string): string => {
    if (!options.escapeShell) return value;
    return escapeShellValue(value);
  };

  return str
    .replace(/\$\{file\}/g, apply(context.filePath || ''))
    .replace(/\$\{tool\}/g, apply(context.toolName || ''))
    .replace(/\$\{command\}/g, apply(context.command || ''))
    .replace(/\$\{content\}/g, apply(context.content || ''))
    .replace(/\$\{cwd\}/g, apply(context.workingDirectory || process.cwd()))
    .replace(/\$\{instanceId\}/g, apply(context.instanceId || ''))
    .replace(
      /\$\{toolInput\}/g,
      apply(JSON.stringify(context.toolInput || {}))
    )
    .replace(/\$\{env\.(\w+)\}/g, (_, name) =>
      apply(context.env?.[name] || process.env[name] || '')
    );
}

/**
 * Escape a value for safe shell usage.
 */
export function escapeShellValue(value: string): string {
  if (value === '') return "''";
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/**
 * Parse a command string into command and arguments.
 */
export function parseCommand(
  command: string
): { command: string; args: string[] } | null {
  const args: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaped || inSingle || inDouble) {
    return null;
  }

  if (current) args.push(current);
  if (args.length === 0) return null;
  const [cmd, ...rest] = args;
  return { command: cmd, args: rest };
}

/**
 * Resolve an executable to its full path.
 */
export function resolveExecutable(command: string, cwd: string): string | null {
  const hasPath = command.includes('/') || command.includes('\\');
  const candidate = hasPath ? path.resolve(cwd, command) : command;
  if (hasPath && fs.existsSync(candidate)) {
    return candidate;
  }

  const pathEntries = (process.env['PATH'] || '')
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const fullPath = path.join(entry, command);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Check if an executable is allowed.
 */
export function isExecutableAllowed(
  resolvedPath: string,
  allowedExecutables: string[] | undefined,
  allowedExecutableDirs: string[]
): boolean {
  if (allowedExecutables && allowedExecutables.length > 0) {
    const baseName = path.basename(resolvedPath);
    return allowedExecutables.some((allowed) => {
      if (allowed === baseName) return true;
      return path.resolve(allowed) === path.resolve(resolvedPath);
    });
  }

  return allowedExecutableDirs.some((dir) =>
    resolvedPath.startsWith(path.resolve(dir) + path.sep)
  );
}

/**
 * Check if a script path is allowed.
 */
export function isScriptAllowed(
  resolvedPath: string,
  allowedDirs: string[] | undefined,
  allowedScriptDirs: string[],
  cwd: string
): boolean {
  const dirs =
    allowedDirs && allowedDirs.length > 0
      ? allowedDirs
      : allowedScriptDirs.length > 0
        ? allowedScriptDirs
        : [cwd];

  return dirs.some((dir) => {
    const base = path.resolve(dir) + path.sep;
    return resolvedPath.startsWith(base);
  });
}

/**
 * Parse blocking result from command output.
 */
export function parseBlockingResult(
  output: string,
  errorOutput: string,
  exitCode: number | null,
  isBlocking: boolean
): {
  action: 'allow' | 'block' | 'modify';
  blockReason?: string;
  modifiedData?: Record<string, unknown>;
} {
  let action: 'allow' | 'block' | 'modify' = 'allow';
  let blockReason: string | undefined;
  let modifiedData: Record<string, unknown> | undefined;

  if (isBlocking && exitCode !== 0) {
    action = 'block';
    blockReason = errorOutput || `Hook exited with code ${exitCode}`;
  } else if (output.includes('HOOK_BLOCK:')) {
    action = 'block';
    blockReason = output.split('HOOK_BLOCK:')[1]?.trim();
  } else if (output.includes('HOOK_MODIFY:')) {
    action = 'modify';
    try {
      const jsonStr = output.split('HOOK_MODIFY:')[1]?.trim();
      modifiedData = JSON.parse(jsonStr);
    } catch {
      // Invalid JSON, ignore modification
    }
  }

  return { action, blockReason, modifiedData };
}
