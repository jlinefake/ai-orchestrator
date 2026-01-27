/**
 * Hook Function Module
 *
 * Function execution for hooks.
 */

import type {
  EnhancedHookConfig,
  HookExecutionContext,
  HookExecutionResult
} from './hook-types';

/**
 * Execute a function hook.
 */
export async function executeFunction(
  hook: EnhancedHookConfig,
  context: HookExecutionContext,
  registeredFunctions: Map<
    string,
    (context: HookExecutionContext) => Promise<HookExecutionResult>
  >
): Promise<HookExecutionResult> {
  const startTime = Date.now();
  const functionName = hook.handler.functionName;

  if (!functionName) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: 'No function name specified',
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  const fn = registeredFunctions.get(functionName);
  if (!fn) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: `Function not registered: ${functionName}`,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  try {
    const result = await fn(context);
    return {
      ...result,
      hookId: hook.id,
      hookName: hook.name,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  } catch (error) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: (error as Error).message,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }
}
