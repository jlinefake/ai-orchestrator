/**
 * GRPO Trainer
 * Group Relative Policy Optimization based on DeepSeek GRPO
 *
 * Key Features:
 * - No critic model needed (unlike PPO)
 * - Groups outcomes and computes relative advantages
 * - Works with verifiable rewards (task success)
 * - Training-free approach for orchestrator (updates strategies, not weights)
 */

import { EventEmitter } from 'events';

// ============ Types ============

export interface GRPOConfig {
  groupSize: number; // Outcomes per group
  learningRate: number;
  clipEpsilon: number; // PPO-style clipping
  entropyCoef: number; // Exploration bonus
  valueCoef: number;
  minSamplesForTraining: number;
  maxBatchHistory: number;
}

export interface GRPOBatch {
  prompts: string[];
  responses: string[];
  rewards: number[];
  advantages: number[]; // Computed from group relative
  taskIds: string[];
  timestamp: number;
}

export interface TrainingOutcome {
  taskId: string;
  prompt: string;
  response: string;
  reward: number; // 0-1, task success score
  strategy?: string;
  context?: string;
  timestamp: number;
}

export interface TrainingStats {
  totalOutcomes: number;
  totalBatches: number;
  avgReward: number;
  avgAdvantage: number;
  rewardTrend: number[]; // Last N average rewards
  strategyPerformance: Map<string, { avgReward: number; count: number }>;
}

export interface StrategyUpdate {
  strategyId: string;
  adjustment: number; // Positive = use more, negative = use less
  confidence: number;
  reasoning: string;
}

// ============ GRPO Trainer ============

export class GRPOTrainer extends EventEmitter {
  private static instance: GRPOTrainer | null = null;
  private config: GRPOConfig;
  private outcomes: TrainingOutcome[] = [];
  private batches: GRPOBatch[] = [];
  private stats: TrainingStats;

  private defaultConfig: GRPOConfig = {
    groupSize: 8,
    learningRate: 0.001,
    clipEpsilon: 0.2,
    entropyCoef: 0.01,
    valueCoef: 0.5,
    minSamplesForTraining: 16,
    maxBatchHistory: 100,
  };

  static getInstance(): GRPOTrainer {
    if (!this.instance) {
      this.instance = new GRPOTrainer();
    }
    return this.instance;
  }

  static _resetForTesting(): void {
    this.instance = null;
  }

  private constructor() {
    super();
    this.config = { ...this.defaultConfig };
    this.stats = {
      totalOutcomes: 0,
      totalBatches: 0,
      avgReward: 0,
      avgAdvantage: 0,
      rewardTrend: [],
      strategyPerformance: new Map(),
    };
  }

  configure(config: Partial<GRPOConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GRPOConfig {
    return { ...this.config };
  }

  // ============ Recording Outcomes ============

  recordOutcome(outcome: Omit<TrainingOutcome, 'timestamp'>): void {
    const fullOutcome: TrainingOutcome = {
      ...outcome,
      timestamp: Date.now(),
    };

    this.outcomes.push(fullOutcome);
    this.stats.totalOutcomes++;

    // Update strategy performance
    if (outcome.strategy) {
      const existing = this.stats.strategyPerformance.get(outcome.strategy) || { avgReward: 0, count: 0 };
      existing.avgReward = (existing.avgReward * existing.count + outcome.reward) / (existing.count + 1);
      existing.count++;
      this.stats.strategyPerformance.set(outcome.strategy, existing);
    }

    // Check if we have enough for a batch
    if (this.outcomes.length >= this.config.groupSize) {
      this.processBatch();
    }

    this.emit('outcome:recorded', fullOutcome);
  }

  // ============ GRPO Core Algorithm ============

  private processBatch(): void {
    if (this.outcomes.length < this.config.groupSize) return;

    // Take a batch of outcomes
    const batchOutcomes = this.outcomes.splice(0, this.config.groupSize);

    const rewards = batchOutcomes.map(o => o.reward);
    const advantages = this.computeAdvantages(rewards);

    const batch: GRPOBatch = {
      prompts: batchOutcomes.map(o => o.prompt),
      responses: batchOutcomes.map(o => o.response),
      rewards,
      advantages,
      taskIds: batchOutcomes.map(o => o.taskId),
      timestamp: Date.now(),
    };

    this.batches.push(batch);

    // Keep bounded history
    if (this.batches.length > this.config.maxBatchHistory) {
      this.batches.shift();
    }

    // Update stats
    this.stats.totalBatches++;
    this.updateStats(batch);

    // Generate strategy updates
    const updates = this.generateStrategyUpdates(batch, batchOutcomes);

    this.emit('batch:processed', { batch, updates });
  }

  computeAdvantages(rewards: number[]): number[] {
    if (rewards.length === 0) return [];

    const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const variance = rewards.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rewards.length;
    const std = Math.sqrt(variance);

    // Normalize advantages (avoid division by zero)
    return rewards.map(r => (std > 1e-8 ? (r - mean) / std : r - mean));
  }

  private generateStrategyUpdates(batch: GRPOBatch, outcomes: TrainingOutcome[]): StrategyUpdate[] {
    const updates: StrategyUpdate[] = [];
    const strategyAdvantages = new Map<string, number[]>();

    // Group advantages by strategy
    for (let i = 0; i < outcomes.length; i++) {
      const strategy = outcomes[i].strategy;
      if (strategy) {
        const existing = strategyAdvantages.get(strategy) || [];
        existing.push(batch.advantages[i]);
        strategyAdvantages.set(strategy, existing);
      }
    }

    // Generate updates for each strategy
    for (const [strategyId, advantages] of strategyAdvantages) {
      const avgAdvantage = advantages.reduce((a, b) => a + b, 0) / advantages.length;

      // Only update if we have enough samples and significant advantage
      if (advantages.length >= 2 && Math.abs(avgAdvantage) > 0.1) {
        const adjustment = avgAdvantage * this.config.learningRate;
        const confidence = Math.min(1, advantages.length / this.config.groupSize);

        updates.push({
          strategyId,
          adjustment,
          confidence,
          reasoning:
            avgAdvantage > 0
              ? `Strategy "${strategyId}" performs above average (advantage: ${avgAdvantage.toFixed(2)})`
              : `Strategy "${strategyId}" performs below average (advantage: ${avgAdvantage.toFixed(2)})`,
        });
      }
    }

    return updates;
  }

  // ============ Training Step (Simplified for Orchestrator) ============

  async trainStep(batch: GRPOBatch): Promise<{ loss: number; updates: StrategyUpdate[] }> {
    // In a full implementation, this would update model weights
    // For orchestrator, we return strategy adjustments instead

    const loss = this.computeLoss(batch);
    const updates: StrategyUpdate[] = [];

    // The orchestrator uses this to update its strategy preferences
    // rather than actual model weights

    this.emit('training:step', { loss, batchSize: batch.rewards.length });

    return { loss, updates };
  }

  private computeLoss(batch: GRPOBatch): number {
    // Simplified loss computation
    // In full GRPO: L = -E[min(r*A, clip(r, 1-e, 1+e)*A)] + c1*L_value + c2*entropy

    let policyLoss = 0;
    for (const advantage of batch.advantages) {
      // Simplified: just use advantages directly
      policyLoss -= advantage;
    }

    return policyLoss / batch.advantages.length;
  }

  // ============ Statistics ============

  private updateStats(batch: GRPOBatch): void {
    const n = this.stats.totalBatches - 1;
    const batchAvgReward = batch.rewards.reduce((a, b) => a + b, 0) / batch.rewards.length;
    const batchAvgAdvantage = batch.advantages.reduce((a, b) => a + b, 0) / batch.advantages.length;

    this.stats.avgReward = (this.stats.avgReward * n + batchAvgReward) / (n + 1);
    this.stats.avgAdvantage = (this.stats.avgAdvantage * n + batchAvgAdvantage) / (n + 1);

    // Track reward trend
    this.stats.rewardTrend.push(batchAvgReward);
    if (this.stats.rewardTrend.length > 50) {
      this.stats.rewardTrend.shift();
    }
  }

  getStats(): TrainingStats {
    return {
      ...this.stats,
      strategyPerformance: new Map(this.stats.strategyPerformance),
    };
  }

  // ============ Data Export ============

  exportTrainingData(): {
    outcomes: TrainingOutcome[];
    batches: GRPOBatch[];
    stats: TrainingStats;
  } {
    return {
      outcomes: [...this.outcomes],
      batches: [...this.batches],
      stats: this.getStats(),
    };
  }

  importTrainingData(data: { outcomes: TrainingOutcome[]; batches: GRPOBatch[] }): void {
    this.outcomes.push(...data.outcomes);
    this.batches.push(...data.batches);

    // Recalculate stats
    for (const batch of data.batches) {
      this.updateStats(batch);
    }

    this.emit('data:imported', { outcomes: data.outcomes.length, batches: data.batches.length });
  }

  // ============ Reward Trend Analysis ============

  getRewardTrend(): { improving: boolean; slope: number; recent: number[] } {
    const recent = this.stats.rewardTrend.slice(-10);
    if (recent.length < 2) {
      return { improving: false, slope: 0, recent };
    }

    // Simple linear regression
    const n = recent.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = recent.reduce((a, b) => a + b, 0);
    const sumXY = recent.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return {
      improving: slope > 0.01,
      slope,
      recent,
    };
  }

  // ============ Strategy Recommendations ============

  getTopStrategies(limit: number = 5): Array<{ strategy: string; avgReward: number; count: number }> {
    return Array.from(this.stats.strategyPerformance.entries())
      .map(([strategy, data]) => ({ strategy, ...data }))
      .sort((a, b) => b.avgReward - a.avgReward)
      .slice(0, limit);
  }

  getUnderperformingStrategies(threshold: number = 0.5): string[] {
    return Array.from(this.stats.strategyPerformance.entries())
      .filter(([, data]) => data.avgReward < threshold && data.count >= 3)
      .map(([strategy]) => strategy);
  }
}

// Export singleton getter
export function getGRPOTrainer(): GRPOTrainer {
  return GRPOTrainer.getInstance();
}
