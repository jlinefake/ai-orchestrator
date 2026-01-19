/**
 * Supervision Types - Erlang/OTP-style supervision patterns for agent management
 * Based on validated patterns from Erlang/OTP, LangGraph, OpenAI Agents SDK, Microsoft AutoGen
 */

export type SupervisionStrategy =
  | 'one-for-one' // Restart only the failed child
  | 'one-for-all' // Restart all children if one fails
  | 'rest-for-one' // Restart failed child and all started after it
  | 'simple-one'; // Dynamic children, no restart

export type RestartType =
  | 'permanent' // Always restart
  | 'transient' // Restart only on abnormal termination
  | 'temporary'; // Never restart

export type RestartAction =
  | 'restart' // Restart the child
  | 'escalate' // Pass failure to parent supervisor
  | 'ignore' // Log and continue
  | 'stop'; // Stop all children

export interface BackoffConfig {
  minDelayMs: number; // Initial delay (default: 100)
  maxDelayMs: number; // Maximum delay (default: 30000)
  factor: number; // Exponential factor (default: 2)
  jitter: boolean; // Add randomness (default: true)
  resetAfterMs: number; // Reset counter after success (default: 5000)
}

export interface HealthCheckConfig {
  intervalMs: number; // How often to check (default: 30000)
  timeoutMs: number; // Timeout for health check (default: 5000)
  unhealthyThreshold: number; // Consecutive failures before unhealthy (default: 3)
}

export interface SupervisorConfig {
  strategy: SupervisionStrategy;

  // Restart limits (Erlang intensity/period)
  maxRestarts: number; // Max restarts in time window
  maxTime: number; // Time window (ms)
  onExhausted: RestartAction; // What to do when restarts exhausted

  // Backoff configuration (validated from research)
  backoff: BackoffConfig;

  // Health monitoring
  healthCheck: HealthCheckConfig;
}

export interface ChildSpec {
  id: string;
  name: string;
  restartType: RestartType;
  startFunc: () => Promise<string>; // Returns instance ID
  stopFunc?: (instanceId: string) => Promise<void>;
  dependencies?: string[]; // Other child IDs this depends on
  order: number; // Start order (for rest-for-one)
}

export interface SupervisionTree {
  root: SupervisorNode;
  metadata: {
    createdAt: number;
    instanceId: string;
    totalRestarts: number;
    lastRestart?: number;
  };
}

export type NodeStatus = 'running' | 'stopped' | 'restarting' | 'degraded' | 'failed';

export interface SupervisorNode {
  id: string;
  name: string;
  config: SupervisorConfig;
  children: (SupervisorNode | WorkerNode)[];
  status: NodeStatus;
  restartHistory: RestartEvent[];
  healthStatus: HealthStatus;
}

export type WorkerStatus = 'running' | 'completed' | 'failed' | 'restarting' | 'stopped';

export interface WorkerNode {
  id: string;
  name: string;
  instanceId: string; // Child instance ID
  type: 'worker';
  spec: ChildSpec;
  status: WorkerStatus;
  startedAt: number;
  restartCount: number;
  consecutiveFailures: number;
  lastError?: string;
  lastHealthCheck?: number;
  backoffState: BackoffState;
}

export interface BackoffState {
  currentDelayMs: number;
  attemptsSinceReset: number;
  lastAttemptAt: number;
  lastSuccessAt?: number;
}

export interface RestartEvent {
  timestamp: number;
  childId: string;
  childName: string;
  reason: string;
  action: RestartAction;
  delayMs: number;
  attemptNumber: number;
}

export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  issues: string[];
}

export type CircuitBreakerStatus = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  status: CircuitBreakerStatus;
  failureCount: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  openedAt?: number;
}

// Events
export type SupervisionEventType =
  | 'supervisor:tree-created'
  | 'worker:added'
  | 'worker:started'
  | 'worker:start-failed'
  | 'worker:failed'
  | 'worker:restarting'
  | 'worker:terminated'
  | 'worker:completed'
  | 'circuit-breaker:opened'
  | 'circuit-breaker:half-open'
  | 'circuit-breaker:closed'
  | 'supervision:exhausted'
  | 'supervision:escalated';

export interface SupervisionEvent {
  type: SupervisionEventType;
  tree?: SupervisionTree;
  worker?: WorkerNode;
  supervisor?: SupervisorNode;
  error?: string;
  delay?: number;
  reason?: string;
}

// Helper functions
export function createDefaultSupervisorConfig(): SupervisorConfig {
  return {
    strategy: 'one-for-one',
    maxRestarts: 5,
    maxTime: 60000,
    onExhausted: 'escalate',
    backoff: {
      minDelayMs: 100,
      maxDelayMs: 30000,
      factor: 2,
      jitter: true,
      resetAfterMs: 5000,
    },
    healthCheck: {
      intervalMs: 30000,
      timeoutMs: 5000,
      unhealthyThreshold: 3,
    },
  };
}

export function createDefaultBackoffState(config: BackoffConfig): BackoffState {
  return {
    currentDelayMs: config.minDelayMs,
    attemptsSinceReset: 0,
    lastAttemptAt: 0,
  };
}

export function isNodeHealthy(node: SupervisorNode | WorkerNode): boolean {
  if ('healthStatus' in node) {
    return node.healthStatus.isHealthy;
  }
  return node.status === 'running';
}

export function isWorkerNode(node: SupervisorNode | WorkerNode): node is WorkerNode {
  return 'type' in node && node.type === 'worker';
}

export function isSupervisorNode(node: SupervisorNode | WorkerNode): node is SupervisorNode {
  return 'children' in node;
}

export function calculateBackoffDelay(state: BackoffState, config: BackoffConfig): number {
  let delay = config.minDelayMs * Math.pow(config.factor, state.attemptsSinceReset);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitter) {
    const jitterFactor = 0.5 + Math.random();
    delay = Math.round(delay * jitterFactor);
  }

  return delay;
}

export function shouldResetBackoff(state: BackoffState, config: BackoffConfig): boolean {
  return state.lastSuccessAt !== undefined && Date.now() - state.lastSuccessAt > config.resetAfterMs;
}
