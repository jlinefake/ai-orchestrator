/**
 * Hook Executor Module - Barrel Exports
 *
 * This module provides the decomposed hook execution functionality.
 */

// Types
export type {
  HookTiming,
  HookAction,
  EnhancedHookConfig,
  EnhancedHookHandler,
  HookCondition,
  HookExecutionContext,
  HookExecutionResult,
  BlockingResult
} from './hook-types';

export {
  DEFAULT_TIMEOUT,
  MAX_OUTPUT_SIZE,
  SHELL_METACHAR_PATTERN,
  DEFAULT_ALLOWED_EXEC_DIRS
} from './hook-types';

// Validation
export {
  checkConditions,
  checkCondition,
  matchPattern
} from './hook-validation';

// Utilities
export {
  interpolateString,
  escapeShellValue,
  parseCommand,
  resolveExecutable,
  isExecutableAllowed,
  isScriptAllowed,
  parseBlockingResult
} from './hook-utils';

// Command execution
export { executeCommand } from './hook-command';

// Script execution
export { executeScript } from './hook-script';

// Prompt execution
export { executePrompt } from './hook-prompt';

// Function execution
export { executeFunction } from './hook-function';

// Dependencies
export {
  resolveDependencies,
  sortByPriority,
  checkDependenciesSucceeded
} from './hook-dependencies';

// Approval
export { requestApproval } from './hook-approval';
