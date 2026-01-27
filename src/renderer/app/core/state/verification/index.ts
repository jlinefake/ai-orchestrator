/**
 * Verification Store - Barrel Exports
 *
 * This module exports all verification store components.
 * Import from this file for clean, organized imports.
 *
 * @example
 * import { VerificationStore, VerificationSession, VerificationStatus } from './verification';
 */

// Main Store (facade/coordinator)
export { VerificationStore } from './verification.store';

// Sub-stores (for direct access if needed)
export { VerificationStateService } from './verification-state.service';
export { VerificationQueries } from './verification.queries';
export { VerificationCliStore } from './verification-cli.store';
export { VerificationConfigStore } from './verification-config.store';
export { VerificationSessionStore } from './verification-session.store';

// Types
export type {
  VerificationStatus,
  AgentProgress,
  VerificationUIConfig,
  VerificationSession,
  CliDetectionResult,
  VerificationStoreState,
  CliInfo,
  CliType,
  VerificationResult,
  PersonalityType,
  SynthesisStrategy,
  AgentResponse,
} from './verification.types';

export { DEFAULT_VERIFICATION_CONFIG } from './verification.types';
