/**
 * Process Management Module
 *
 * Provides Erlang/OTP-style supervision patterns for managing
 * Claude Code instances in a hierarchical tree structure.
 *
 * Key Components:
 * - SupervisorTree: Root supervisor with auto-expansion for 10,000+ instances
 * - SupervisorNodeManager: Individual supervisor nodes with restart strategies
 * - CircuitBreaker: Resource protection and restart rate limiting
 */

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  getCircuitBreakerRegistry,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
} from './circuit-breaker';

// Supervisor Node
export {
  SupervisorNodeManager,
  DEFAULT_NODE_CONFIG,
  type SupervisorNodeConfig,
  type ManagedWorker,
} from './supervisor-node';

// Supervisor Tree
export {
  SupervisorTree,
  getSupervisorTree,
  DEFAULT_TREE_CONFIG,
  type SupervisorTreeConfig,
  type InstanceRegistration,
} from './supervisor-tree';
