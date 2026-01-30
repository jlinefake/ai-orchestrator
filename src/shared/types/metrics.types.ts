/**
 * Metrics Types
 * Types for baseline metrics collection and comparison (Phase 0)
 */

// ============================================
// Session Metrics
// ============================================

export interface SessionMetrics {
  sessionId: string;
  timestamp: number;

  // Context metrics
  tokensUsed: number;
  contextUtilizationPercent: number;
  compactionTriggered: boolean;
  compactionTier: CompactionTier | null;

  // Memory metrics
  memoriesRetrieved: number;
  memoriesSelected: number;
  retrievalLatencyMs: number;
  cacheHitRate: number;

  // Learning metrics
  memoryR1Decisions: MemoryR1DecisionCounts;
  trajectoryMatches: number;
  patternMatches: number;

  // Outcome metrics
  taskCompleted: boolean;
  taskScore: number;
  userCorrections: number;

  // Cost metrics (for prompt caching - Phase 1)
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  estimatedCostSavings?: number;

  // Additional metadata
  qualityCostProfile: 'quality' | 'balanced' | 'cost';
  trainingStage: 1 | 2 | 3;
}

export type CompactionTier = 'FULL' | 'SECTION' | 'KEY_DECISIONS' | 'MINIMAL';

export interface MemoryR1DecisionCounts {
  add: number;
  update: number;
  delete: number;
  noop: number;
}

// ============================================
// Aggregated Metrics Report
// ============================================

export interface MetricsReport {
  startDate: number;
  endDate: number;
  sessionCount: number;

  // Aggregate metrics
  avgTokensPerSession: number;
  compactionRate: number;
  avgRetrievalLatency: number;
  taskCompletionRate: number;

  // Learning effectiveness
  memoryUtilization: MemoryUtilizationMetrics;
  trajectoryLearningImpact: number;

  // Cost impact (if caching enabled)
  totalCostSavings: number;
  avgCacheHitRate: number;

  // Trends
  dailyTrends: DailyTrend[];

  // Distribution
  compactionTierDistribution: Record<CompactionTier | 'none', number>;
  decisionDistribution: MemoryR1DecisionCounts;
}

export interface MemoryUtilizationMetrics {
  avgMemoriesRetrieved: number;
  avgMemoriesSelected: number;
  selectionEfficiency: number; // selected / retrieved ratio
}

export interface DailyTrend {
  date: string; // YYYY-MM-DD
  sessionCount: number;
  avgTaskCompletion: number;
  avgTokens: number;
  avgLatency: number;
}

// ============================================
// Baseline Snapshot
// ============================================

export interface BaselineSnapshot {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  sessionCount: number;

  // Key baseline values
  avgTokensPerSession: number;
  taskCompletionRate: number;
  avgRetrievalLatency: number;
  compactionRate: number;
  avgCacheHitRate: number;

  // Full report for detailed comparison
  fullReport: MetricsReport;
}

export interface BaselineComparison {
  baselineId: string;
  baselineName: string;
  comparisonPeriod: { start: number; end: number };

  // Percentage changes (positive = improvement)
  tokenReduction: number;
  taskCompletionImprovement: number;
  latencyReduction: number;
  compactionRateChange: number;
  cacheHitImprovement: number;

  // Statistical significance (if enough samples)
  isSignificant: boolean;
  confidenceLevel: number;
}

// ============================================
// Configuration
// ============================================

export interface MetricsCollectorConfig {
  enabled: boolean;
  persistMetrics: boolean;
  maxStoredSessions: number;
  retentionDays: number;
  autoBaselineInterval?: number; // ms, optional auto-capture baseline
}

// ============================================
// Events
// ============================================

export interface MetricsEvents {
  'session:recorded': SessionMetrics;
  'baseline:created': BaselineSnapshot;
  'report:generated': MetricsReport;
  'threshold:exceeded': { metric: string; value: number; threshold: number };
}
