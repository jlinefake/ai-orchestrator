/**
 * Verification Store - Backwards Compatibility Re-exports
 *
 * This file maintains backwards compatibility for existing imports.
 * The store has been decomposed into smaller modules in ./verification/
 *
 * @deprecated Import from './verification' instead for new code
 */

// Re-export everything from the new location
export * from './verification';

// Explicit re-exports for named imports
export { VerificationStore } from './verification';
export type {
  VerificationStatus,
  AgentProgress,
  VerificationSession,
  VerificationUIConfig,
  CliDetectionResult,
} from './verification';
