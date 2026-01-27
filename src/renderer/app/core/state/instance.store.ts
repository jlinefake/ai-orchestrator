/**
 * Instance Store - Backwards Compatibility Re-exports
 *
 * This file maintains backwards compatibility for existing imports.
 * The store has been decomposed into smaller modules in ./instance/
 *
 * @deprecated Import from './instance' instead for new code
 */

// Re-export everything from the new location
export * from './instance';

// Explicit re-exports for named imports
export { InstanceStore } from './instance';
export type {
  InstanceStatus,
  ContextUsage,
  OutputMessage,
  InstanceProvider,
  Instance,
} from './instance';
