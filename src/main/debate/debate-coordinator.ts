/**
 * Debate Coordinator
 * Multi-round debate system for complex decisions
 *
 * Building on Phase 7's multi-verification, adds multi-round debate:
 * Round 1: Independent responses - N diverse answers
 * Round 2: Cross-critique - Each agent critiques others
 * Round 3: Defense & revision - Agents defend/revise positions
 * Round 4: Synthesis - Moderator extracts best elements
 */

import { EventEmitter } from 'events';
import type {
  DebateConfig,
  DebateSessionRound,
  DebateContribution,
  DebateResult,
  ActiveDebate,
  DebateStatus,
  AgentCritique,
  ConsensusAnalysis,
  ConsensusAgreement,
  ConsensusDisagreement,
  DebateStats,
  DebateRoundType,
  CritiqueSeverity,
} from '../../shared/types/debate.types';

export class DebateCoordinator extends EventEmitter {
  private static instance: DebateCoordinator;
  private activeDebates: Map<string, ActiveDebate> = new Map();
  private completedDebates: Map<string, DebateResult> = new Map();
  private stats: DebateStats;

  private defaultConfig: DebateConfig = {
    agents: 3,
    maxRounds: 4,
    convergenceThreshold: 0.8,
    synthesisModel: 'claude-sonnet-4-20250514',
    temperatureRange: [0.3, 0.9],
    timeout: 300000, // 5 minutes
  };

  static getInstance(): DebateCoordinator {
    if (!this.instance) {
      this.instance = new DebateCoordinator();
    }
    return this.instance;
  }

  private constructor() {
    super();
    this.stats = {
      totalDebates: 0,
      avgRounds: 0,
      avgConsensusScore: 0,
      consensusRate: 0,
      avgDurationMs: 0,
      avgTokensUsed: 0,
    };
  }

  // ============ Debate Lifecycle ============

  async startDebate(query: string, context?: string, config?: Partial<DebateConfig>): Promise<string> {
    const debateId = `debate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mergedConfig = { ...this.defaultConfig, ...config };

    const debate: ActiveDebate = {
      id: debateId,
      config: mergedConfig,
      query,
      context,
      currentRound: 0,
      rounds: [],
      startTime: Date.now(),
      status: 'in_progress',
    };

    this.activeDebates.set(debateId, debate);
    this.emit('debate:started', { debateId, query });

    // Start the debate process
    this.runDebate(debate).catch(err => {
      this.emit('debate:error', { debateId, error: err.message });
    });

    return debateId;
  }

  private async runDebate(debate: ActiveDebate): Promise<void> {
    try {
      // Round 1: Initial responses
      await this.runInitialRound(debate);

      // Rounds 2-N: Critique and defense
      while (debate.currentRound < debate.config.maxRounds - 1) {
        // Check for early convergence
        const lastRound = debate.rounds[debate.rounds.length - 1];
        if (lastRound.consensusScore >= debate.config.convergenceThreshold) {
          break;
        }

        // Check timeout
        if (Date.now() - debate.startTime > debate.config.timeout) {
          debate.status = 'timeout';
          break;
        }

        // Alternate between critique and defense rounds
        if (debate.currentRound % 2 === 1) {
          await this.runCritiqueRound(debate);
        } else {
          await this.runDefenseRound(debate);
        }
      }

      // Final synthesis round
      if (debate.status === 'in_progress') {
        await this.runSynthesisRound(debate);
        debate.status = 'completed';
      }

      // Finalize the debate
      this.finalizeDebate(debate);
    } catch (error) {
      debate.status = 'cancelled';
      this.emit('debate:error', { debateId: debate.id, error: (error as Error).message });
    }
  }

  // ============ Round Implementations ============

  private async runInitialRound(debate: ActiveDebate): Promise<void> {
    const roundStart = Date.now();
    const contributions: DebateContribution[] = [];

    // Generate diverse responses from each agent
    for (let i = 0; i < debate.config.agents; i++) {
      const temperature = this.getAgentTemperature(i, debate.config);
      const contribution = await this.generateInitialResponse(debate, i, temperature);
      contributions.push(contribution);
    }

    const round: DebateSessionRound = {
      roundNumber: 1,
      type: 'initial',
      contributions,
      consensusScore: this.calculateConsensus(contributions),
      timestamp: Date.now(),
      durationMs: Date.now() - roundStart,
    };

    debate.rounds.push(round);
    debate.currentRound = 1;

    this.emit('debate:round-complete', { debateId: debate.id, round });
  }

  private async runCritiqueRound(debate: ActiveDebate): Promise<void> {
    const roundStart = Date.now();
    const previousRound = debate.rounds[debate.rounds.length - 1];
    const contributions: DebateContribution[] = [];

    // Each agent critiques the others
    for (let i = 0; i < debate.config.agents; i++) {
      const critiques = await this.generateCritiques(debate, i, previousRound.contributions);
      const contribution: DebateContribution = {
        agentId: `agent-${i}`,
        content: previousRound.contributions[i].content, // Keep original content
        critiques,
        confidence: previousRound.contributions[i].confidence,
        reasoning: 'Cross-critique of other positions',
      };
      contributions.push(contribution);
    }

    const round: DebateSessionRound = {
      roundNumber: debate.currentRound + 1,
      type: 'critique',
      contributions,
      consensusScore: this.calculateConsensus(contributions),
      timestamp: Date.now(),
      durationMs: Date.now() - roundStart,
    };

    debate.rounds.push(round);
    debate.currentRound++;

    this.emit('debate:round-complete', { debateId: debate.id, round });
  }

  private async runDefenseRound(debate: ActiveDebate): Promise<void> {
    const roundStart = Date.now();
    const critiqueRound = debate.rounds[debate.rounds.length - 1];
    const contributions: DebateContribution[] = [];

    // Each agent defends their position and potentially revises
    for (let i = 0; i < debate.config.agents; i++) {
      // Collect critiques directed at this agent
      const critiquesReceived = critiqueRound.contributions
        .flatMap(c => c.critiques || [])
        .filter(crit => crit.targetAgentId === `agent-${i}`);

      const contribution = await this.generateDefense(debate, i, critiquesReceived);
      contributions.push(contribution);
    }

    const round: DebateSessionRound = {
      roundNumber: debate.currentRound + 1,
      type: 'defense',
      contributions,
      consensusScore: this.calculateConsensus(contributions),
      timestamp: Date.now(),
      durationMs: Date.now() - roundStart,
    };

    debate.rounds.push(round);
    debate.currentRound++;

    this.emit('debate:round-complete', { debateId: debate.id, round });
  }

  private async runSynthesisRound(debate: ActiveDebate): Promise<void> {
    const roundStart = Date.now();

    // Analyze consensus across all rounds
    const consensusAnalysis = this.analyzeConsensus(debate);

    // Generate final synthesis
    const synthesis = await this.generateSynthesis(debate, consensusAnalysis);

    const contribution: DebateContribution = {
      agentId: 'moderator',
      content: synthesis,
      confidence: consensusAnalysis.overallScore,
      reasoning: 'Final synthesis of debate positions',
    };

    const round: DebateSessionRound = {
      roundNumber: debate.currentRound + 1,
      type: 'synthesis',
      contributions: [contribution],
      consensusScore: consensusAnalysis.overallScore,
      timestamp: Date.now(),
      durationMs: Date.now() - roundStart,
    };

    debate.rounds.push(round);
    debate.currentRound++;

    this.emit('debate:round-complete', { debateId: debate.id, round });
  }

  // ============ Response Generation (Placeholder) ============

  private async generateInitialResponse(
    debate: ActiveDebate,
    agentIndex: number,
    temperature: number
  ): Promise<DebateContribution> {
    // Placeholder - actual implementation calls LLM
    return {
      agentId: `agent-${agentIndex}`,
      content: `Initial response from agent ${agentIndex} for: ${debate.query}`,
      confidence: 0.7 + Math.random() * 0.2,
      reasoning: 'Based on initial analysis',
    };
  }

  private async generateCritiques(
    debate: ActiveDebate,
    agentIndex: number,
    contributions: DebateContribution[]
  ): Promise<AgentCritique[]> {
    const critiques: AgentCritique[] = [];

    // Critique other agents' responses
    for (let i = 0; i < contributions.length; i++) {
      if (i === agentIndex) continue; // Skip self

      // Placeholder - actual implementation uses LLM
      critiques.push({
        targetAgentId: `agent-${i}`,
        issue: `Potential issue with agent ${i}'s approach`,
        severity: 'minor' as CritiqueSeverity,
        counterpoint: 'Alternative approach suggested',
      });
    }

    return critiques;
  }

  private async generateDefense(
    debate: ActiveDebate,
    agentIndex: number,
    critiquesReceived: AgentCritique[]
  ): Promise<DebateContribution> {
    // Placeholder - actual implementation uses LLM
    const defenses = critiquesReceived.map(c => `Defense against: ${c.issue}`);

    return {
      agentId: `agent-${agentIndex}`,
      content: `Revised position from agent ${agentIndex}`,
      defenses,
      confidence: 0.75 + Math.random() * 0.2,
      reasoning: 'Addressed critiques and refined position',
    };
  }

  private async generateSynthesis(debate: ActiveDebate, consensusAnalysis: ConsensusAnalysis): Promise<string> {
    // Placeholder - actual implementation uses LLM
    const agreements = consensusAnalysis.agreements.map(a => a.topic).join(', ');
    return `Synthesis: Key agreements on ${agreements}. Debate concluded with ${Math.round(consensusAnalysis.overallScore * 100)}% consensus.`;
  }

  // ============ Consensus Analysis ============

  private calculateConsensus(contributions: DebateContribution[]): number {
    if (contributions.length <= 1) return 1.0;

    // Simple text similarity-based consensus
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < contributions.length; i++) {
      for (let j = i + 1; j < contributions.length; j++) {
        totalSimilarity += this.textSimilarity(contributions[i].content, contributions[j].content);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private analyzeConsensus(debate: ActiveDebate): ConsensusAnalysis {
    const lastRound = debate.rounds[debate.rounds.length - 1];
    const allContributions = debate.rounds.flatMap(r => r.contributions);

    // Extract topics (simplified)
    const topics = this.extractTopics(allContributions);
    const agreements: ConsensusAgreement[] = [];
    const disagreements: ConsensusDisagreement[] = [];

    for (const topic of topics) {
      const positions = new Map<string, string>();
      for (const contribution of lastRound.contributions) {
        if (contribution.content.toLowerCase().includes(topic.toLowerCase())) {
          positions.set(contribution.agentId, contribution.content);
        }
      }

      if (positions.size >= debate.config.agents * 0.7) {
        agreements.push({
          topic,
          confidence: 0.8,
          supportingAgents: Array.from(positions.keys()),
        });
      } else if (positions.size > 0) {
        disagreements.push({
          topic,
          positions,
          severity: 'minor',
        });
      }
    }

    return {
      overallScore: lastRound.consensusScore,
      agreements,
      disagreements,
      undecided: [],
    };
  }

  private extractTopics(contributions: DebateContribution[]): string[] {
    // Simplified topic extraction - actual implementation uses NLP
    const words = contributions
      .flatMap(c => c.content.toLowerCase().split(/\s+/))
      .filter(w => w.length > 5);

    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // ============ Helper Methods ============

  private getAgentTemperature(agentIndex: number, config: DebateConfig): number {
    const [min, max] = config.temperatureRange;
    const step = (max - min) / Math.max(1, config.agents - 1);
    return min + step * agentIndex;
  }

  private finalizeDebate(debate: ActiveDebate): void {
    const lastRound = debate.rounds[debate.rounds.length - 1];
    const consensusAnalysis = this.analyzeConsensus(debate);

    const result: DebateResult = {
      id: debate.id,
      query: debate.query,
      rounds: debate.rounds,
      synthesis: lastRound.type === 'synthesis' ? lastRound.contributions[0].content : '',
      consensusReached: lastRound.consensusScore >= debate.config.convergenceThreshold,
      finalConsensusScore: lastRound.consensusScore,
      keyAgreements: consensusAnalysis.agreements.map(a => a.topic),
      unresolvedDisagreements: consensusAnalysis.disagreements.map(d => d.topic),
      tokensUsed: this.estimateTokensUsed(debate),
      duration: Date.now() - debate.startTime,
      status: debate.status,
    };

    this.completedDebates.set(debate.id, result);
    this.activeDebates.delete(debate.id);

    // Update stats
    this.updateStats(result);

    this.emit('debate:completed', result);
  }

  private estimateTokensUsed(debate: ActiveDebate): number {
    let tokens = 0;
    for (const round of debate.rounds) {
      for (const contribution of round.contributions) {
        tokens += Math.ceil(contribution.content.length / 4);
      }
    }
    return tokens;
  }

  private updateStats(result: DebateResult): void {
    const n = this.stats.totalDebates;
    this.stats.totalDebates++;
    this.stats.avgRounds = (this.stats.avgRounds * n + result.rounds.length) / (n + 1);
    this.stats.avgConsensusScore = (this.stats.avgConsensusScore * n + result.finalConsensusScore) / (n + 1);
    this.stats.consensusRate =
      (this.stats.consensusRate * n + (result.consensusReached ? 1 : 0)) / (n + 1);
    this.stats.avgDurationMs = (this.stats.avgDurationMs * n + result.duration) / (n + 1);
    this.stats.avgTokensUsed = (this.stats.avgTokensUsed * n + result.tokensUsed) / (n + 1);
  }

  // ============ Public API ============

  getDebate(debateId: string): ActiveDebate | DebateResult | undefined {
    return this.activeDebates.get(debateId) || this.completedDebates.get(debateId);
  }

  getResult(debateId: string): DebateResult | undefined {
    return this.completedDebates.get(debateId);
  }

  async cancelDebate(debateId: string): Promise<boolean> {
    const debate = this.activeDebates.get(debateId);
    if (!debate) return false;

    debate.status = 'cancelled';
    this.finalizeDebate(debate);
    return true;
  }

  getActiveDebates(): ActiveDebate[] {
    return Array.from(this.activeDebates.values());
  }

  getStats(): DebateStats {
    return { ...this.stats };
  }
}

// Export singleton getter
export function getDebateCoordinator(): DebateCoordinator {
  return DebateCoordinator.getInstance();
}
