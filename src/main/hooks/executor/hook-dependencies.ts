/**
 * Hook Dependencies Module
 *
 * Dependency resolution for hook chains.
 */

import type { EnhancedHookConfig } from './hook-types';

/**
 * Resolve hook dependencies using topological sort.
 * Throws on circular dependencies.
 */
export function resolveDependencies(
  hooks: EnhancedHookConfig[]
): EnhancedHookConfig[] {
  const resolved: EnhancedHookConfig[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();

  const visit = (hook: EnhancedHookConfig): void => {
    if (seen.has(hook.id)) return;
    if (visiting.has(hook.id)) {
      throw new Error(`Circular dependency detected: ${hook.id}`);
    }

    visiting.add(hook.id);

    // Visit dependencies first
    if (hook.dependsOn) {
      for (const depId of hook.dependsOn) {
        const depHook = hooks.find((h) => h.id === depId);
        if (depHook) {
          visit(depHook);
        }
      }
    }

    visiting.delete(hook.id);
    seen.add(hook.id);
    resolved.push(hook);
  };

  for (const hook of hooks) {
    visit(hook);
  }

  return resolved;
}

/**
 * Sort hooks by priority (lower = earlier).
 */
export function sortByPriority(hooks: EnhancedHookConfig[]): EnhancedHookConfig[] {
  return [...hooks].sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

/**
 * Check if dependencies succeeded.
 */
export function checkDependenciesSucceeded(
  hook: EnhancedHookConfig,
  results: Array<{ hookId: string; success: boolean }>
): boolean {
  if (!hook.dependsOn || hook.dependsOn.length === 0) {
    return true;
  }

  return !hook.dependsOn.some((depId) => {
    const depResult = results.find((r) => r.hookId === depId);
    return !depResult || !depResult.success;
  });
}
