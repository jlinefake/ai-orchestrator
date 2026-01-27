/**
 * Hook Validation Module
 *
 * Condition checking and pattern matching.
 */

import type { HookCondition, HookExecutionContext } from './hook-types';

/**
 * Check if all conditions are met.
 */
export function checkConditions(
  conditions: HookCondition[],
  context: HookExecutionContext
): boolean {
  return conditions.every((condition) => checkCondition(condition, context));
}

/**
 * Check a single condition.
 */
export function checkCondition(
  condition: HookCondition,
  context: HookExecutionContext
): boolean {
  const operator = condition.operator || 'equals';

  switch (condition.type) {
    case 'file_pattern': {
      if (!context.filePath) return operator === 'not_equals';
      return matchPattern(context.filePath, condition.value, operator);
    }

    case 'tool_name': {
      if (!context.toolName) return operator === 'not_equals';
      return matchPattern(context.toolName, condition.value, operator);
    }

    case 'content_match': {
      if (!context.content) return operator === 'not_equals';
      return matchPattern(context.content, condition.value, operator);
    }

    case 'env_var': {
      const [varName, expectedValue] = condition.value.split('=');
      const actualValue = context.env?.[varName] || process.env[varName];

      if (operator === 'exists') {
        return actualValue !== undefined;
      }

      if (!actualValue) return operator === 'not_equals';
      return matchPattern(actualValue, expectedValue || '', operator);
    }

    case 'custom':
      // Custom conditions need external evaluation
      return true;

    default:
      return true;
  }
}

/**
 * Match a value against a pattern with the given operator.
 */
export function matchPattern(
  value: string,
  pattern: string,
  operator: string
): boolean {
  switch (operator) {
    case 'equals':
      return value === pattern;
    case 'not_equals':
      return value !== pattern;
    case 'contains':
      return value.includes(pattern);
    case 'matches':
      try {
        return new RegExp(pattern).test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
