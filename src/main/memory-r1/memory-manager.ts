/**
 * Memory Manager Agent
 * RL-Trained Memory Management based on Memory-R1 (arXiv:2508.19828)
 *
 * Core Innovation: Learns ADD/UPDATE/DELETE/NOOP decisions through
 * trial and error rather than handcrafted rules.
 *
 * Features:
 * - Semantic retrieval with embeddings
 * - A-Mem style dynamic linking between related entries
 * - RL-based relevance score updates
 * - Automatic eviction of least relevant entries
 */

import { EventEmitter } from 'events';
import type {
  MemoryEntry,
  MemoryOperation,
  MemoryManagerState,
  MemoryManagerConfig,
  MemoryManagerDecision,
  MemoryOperationLog,
  RetrievalLog,
  MemoryR1Stats,
  MemoryR1Snapshot,
  MemorySourceType,
} from '../../shared/types/memory-r1.types';

export class MemoryManagerAgent extends EventEmitter {
  private static instance: MemoryManagerAgent;
  private state: MemoryManagerState;
  private config: MemoryManagerConfig;

  private defaultConfig: MemoryManagerConfig = {
    maxEntries: 10000,
    maxTokens: 500000,
    topK: 20,
    similarityThreshold: 0.7,
    enableLearning: true,
    learningRate: 0.001,
    rewardDiscount: 0.99,
    batchSize: 32,
    embeddingModel: 'text-embedding-3-small',
    embeddingDimension: 1536,
  };

  static getInstance(): MemoryManagerAgent {
    if (!this.instance) {
      this.instance = new MemoryManagerAgent();
    }
    return this.instance;
  }

  private constructor() {
    super();
    this.config = { ...this.defaultConfig };
    this.state = {
      entries: new Map(),
      totalEntries: 0,
      totalTokens: 0,
      operationHistory: [],
      retrievalHistory: [],
    };
  }

  configure(config: Partial<MemoryManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MemoryManagerConfig {
    return { ...this.config };
  }

  // ============ Memory Operations (RL-Trained) ============

  async decideOperation(
    context: string,
    candidateContent: string,
    taskId: string
  ): Promise<MemoryManagerDecision> {
    const existingRelevant = await this.findRelevant(candidateContent);
    const prompt = this.buildDecisionPrompt(context, candidateContent, existingRelevant);

    // Call LLM for decision (simplified - actual impl uses RL-trained model)
    const decision = await this.callMemoryManagerLLM(prompt, existingRelevant);

    // Log for training
    this.logOperation(decision, taskId);

    return decision;
  }

  private buildDecisionPrompt(
    context: string,
    candidateContent: string,
    existingRelevant: MemoryEntry[]
  ): string {
    const existingSection =
      existingRelevant.length > 0
        ? existingRelevant.map(e => `[${e.id}] ${e.content.slice(0, 200)}...`).join('\n')
        : 'No related memories found.';

    return `
You are a Memory Manager agent. Decide what to do with this information.

## Current Context
${context}

## Candidate Information
${candidateContent}

## Existing Related Memories
${existingSection}

## Available Operations
- ADD: Store as new memory (use when information is novel and useful)
- UPDATE: Modify existing memory (use when information refines existing knowledge)
- DELETE: Remove existing memory (use when information contradicts or obsoletes)
- NOOP: Do nothing (use when information is redundant or not useful)

## Decision Format
Operation: <ADD|UPDATE|DELETE|NOOP>
EntryId: <id if UPDATE/DELETE>
Content: <content if ADD/UPDATE>
Confidence: <0-1>
Reasoning: <brief explanation>
`;
  }

  async executeOperation(decision: MemoryManagerDecision): Promise<MemoryEntry | null> {
    switch (decision.operation) {
      case 'ADD':
        if (!decision.content) return null;
        return this.addEntry(decision.content, decision.reasoning);

      case 'UPDATE':
        if (!decision.entryId || !decision.content) return null;
        return this.updateEntry(decision.entryId, decision.content, decision.reasoning);

      case 'DELETE':
        if (!decision.entryId) return null;
        this.deleteEntry(decision.entryId);
        return null;

      case 'NOOP':
        return null;

      default:
        return null;
    }
  }

  async addEntry(
    content: string,
    reason: string,
    sourceType: MemorySourceType = 'derived',
    sourceSessionId: string = ''
  ): Promise<MemoryEntry> {
    const embedding = await this.computeEmbedding(content);
    const tokens = this.estimateTokens(content);

    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      embedding,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
      sourceType,
      sourceSessionId,
      relevanceScore: 0.5,
      confidenceScore: 0.8,
      linkedEntries: [],
      tags: this.extractTags(content),
      isArchived: false,
    };

    // Check capacity
    if (this.state.totalTokens + tokens > this.config.maxTokens) {
      await this.evictLeastRelevant(tokens);
    }

    this.state.entries.set(entry.id, entry);
    this.state.totalEntries++;
    this.state.totalTokens += tokens;

    // Find and create links (A-Mem pattern)
    await this.createLinks(entry);

    this.emit('entry:added', entry);
    return entry;
  }

  private async updateEntry(entryId: string, newContent: string, reason: string): Promise<MemoryEntry> {
    const entry = this.state.entries.get(entryId);
    if (!entry) throw new Error(`Entry not found: ${entryId}`);

    const oldTokens = this.estimateTokens(entry.content);
    const newTokens = this.estimateTokens(newContent);

    entry.content = newContent;
    entry.embedding = await this.computeEmbedding(newContent);
    entry.updatedAt = Date.now();
    entry.tags = this.extractTags(newContent);

    this.state.totalTokens += newTokens - oldTokens;

    // Re-check links
    await this.updateLinks(entry);

    this.emit('entry:updated', entry);
    return entry;
  }

  deleteEntry(entryId: string): void {
    const entry = this.state.entries.get(entryId);
    if (!entry) return;

    const tokens = this.estimateTokens(entry.content);

    // Remove links from other entries
    for (const linkedId of entry.linkedEntries) {
      const linked = this.state.entries.get(linkedId);
      if (linked) {
        linked.linkedEntries = linked.linkedEntries.filter(id => id !== entryId);
      }
    }

    this.state.entries.delete(entryId);
    this.state.totalEntries--;
    this.state.totalTokens -= tokens;

    this.emit('entry:deleted', entryId);
  }

  // ============ Retrieval (Answer Agent Support) ============

  async retrieve(query: string, taskId: string): Promise<MemoryEntry[]> {
    const queryEmbedding = await this.computeEmbedding(query);

    // Compute similarities
    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of this.state.entries.values()) {
      if (entry.isArchived) continue;
      if (!entry.embedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= this.config.similarityThreshold) {
        scored.push({ entry, score: similarity * entry.relevanceScore });
      }
    }

    // Sort and take top-K
    scored.sort((a, b) => b.score - a.score);
    const retrieved = scored.slice(0, this.config.topK).map(s => {
      s.entry.accessCount++;
      s.entry.lastAccessedAt = Date.now();
      return s.entry;
    });

    // Log for training
    const logEntry: RetrievalLog = {
      id: `ret-${Date.now()}`,
      query,
      retrievedIds: retrieved.map(e => e.id),
      selectedIds: [], // Filled after Answer Agent selection
      timestamp: Date.now(),
      taskId,
    };
    this.state.retrievalHistory.push(logEntry);

    return retrieved;
  }

  markSelectedForRetrieval(fetchId: string, selectedIds: string[]): void {
    const log = this.state.retrievalHistory.find(r => r.id === fetchId);
    if (log) {
      log.selectedIds = selectedIds;
    }
  }

  // ============ A-Mem: Dynamic Linking ============

  private async createLinks(entry: MemoryEntry): Promise<void> {
    if (!entry.embedding) return;

    // Find similar entries for linking
    const candidates: Array<{ entry: MemoryEntry; similarity: number }> = [];

    for (const other of this.state.entries.values()) {
      if (other.id === entry.id) continue;
      if (!other.embedding) continue;

      const similarity = this.cosineSimilarity(entry.embedding, other.embedding);
      if (similarity > 0.8) {
        // High threshold for linking
        candidates.push({ entry: other, similarity });
      }
    }

    // Create bidirectional links
    candidates.sort((a, b) => b.similarity - a.similarity);
    const toLink = candidates.slice(0, 5); // Max 5 links per entry

    for (const { entry: other } of toLink) {
      if (!entry.linkedEntries.includes(other.id)) {
        entry.linkedEntries.push(other.id);
      }
      if (!other.linkedEntries.includes(entry.id)) {
        other.linkedEntries.push(entry.id);
      }
    }
  }

  private async updateLinks(entry: MemoryEntry): Promise<void> {
    // Remove old links
    for (const linkedId of entry.linkedEntries) {
      const linked = this.state.entries.get(linkedId);
      if (linked) {
        linked.linkedEntries = linked.linkedEntries.filter(id => id !== entry.id);
      }
    }
    entry.linkedEntries = [];

    // Create new links
    await this.createLinks(entry);
  }

  // ============ RL Training Feedback ============

  recordTaskOutcome(taskId: string, success: boolean, score: number): void {
    // Update operation outcomes
    for (const log of this.state.operationHistory) {
      if (log.taskId === taskId && log.outcomeScore === undefined) {
        log.outcomeScore = score;
      }
    }

    // Update fetch outcomes
    for (const log of this.state.retrievalHistory) {
      if (log.taskId === taskId && log.retrievalQuality === undefined) {
        log.retrievalQuality = score;
      }
    }

    // Update relevance scores based on fetch success
    if (this.config.enableLearning) {
      this.updateRelevanceScores(taskId, score);
    }

    this.emit('training:outcome-recorded', { taskId, success, score });
  }

  private updateRelevanceScores(taskId: string, outcomeScore: number): void {
    // Find fetches for this task
    const fetches = this.state.retrievalHistory.filter(r => r.taskId === taskId);

    for (const fetch of fetches) {
      // Boost selected entries, reduce non-selected
      for (const entryId of fetch.retrievedIds) {
        const entry = this.state.entries.get(entryId);
        if (!entry) continue;

        const wasSelected = fetch.selectedIds.includes(entryId);
        const delta = wasSelected
          ? this.config.learningRate * outcomeScore
          : -this.config.learningRate * 0.1;

        entry.relevanceScore = Math.max(0, Math.min(1, entry.relevanceScore + delta));
      }
    }
  }

  // ============ Memory Eviction ============

  private async evictLeastRelevant(neededTokens: number): Promise<void> {
    const entries = Array.from(this.state.entries.values())
      .filter(e => !e.isArchived)
      .sort((a, b) => {
        // Score based on relevance, recency, and access count
        const scoreA =
          a.relevanceScore * 0.5 +
          (a.accessCount / 100) * 0.3 +
          ((Date.now() - a.lastAccessedAt) / 86400000) * -0.2;
        const scoreB =
          b.relevanceScore * 0.5 +
          (b.accessCount / 100) * 0.3 +
          ((Date.now() - b.lastAccessedAt) / 86400000) * -0.2;
        return scoreA - scoreB; // Lowest score first
      });

    let freedTokens = 0;
    for (const entry of entries) {
      if (freedTokens >= neededTokens) break;

      const tokens = this.estimateTokens(entry.content);
      this.deleteEntry(entry.id);
      freedTokens += tokens;
    }
  }

  // ============ Utilities ============

  private async computeEmbedding(text: string): Promise<number[]> {
    // Placeholder - actual implementation calls embedding API
    // Return mock embedding based on text hash for consistency
    const hash = this.simpleHash(text);
    return new Array(this.config.embeddingDimension).fill(0).map((_, i) => {
      return Math.sin((hash + i) * 0.1) * 0.5 + 0.5;
    });
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private extractTags(content: string): string[] {
    // Simple tag extraction - can be enhanced with NER
    const words = content.toLowerCase().split(/\s+/);
    return [...new Set(words.filter(w => w.length > 4))].slice(0, 10);
  }

  private async findRelevant(content: string): Promise<MemoryEntry[]> {
    const embedding = await this.computeEmbedding(content);
    const results: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of this.state.entries.values()) {
      if (!entry.embedding) continue;
      const similarity = this.cosineSimilarity(embedding, entry.embedding);
      if (similarity > 0.6) {
        results.push({ entry, score: similarity });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.entry);
  }

  private async callMemoryManagerLLM(
    prompt: string,
    existingRelevant: MemoryEntry[]
  ): Promise<MemoryManagerDecision> {
    // Placeholder - actual implementation calls trained model
    // For now, use simple heuristics

    // If no existing relevant entries, likely ADD
    if (existingRelevant.length === 0) {
      return {
        operation: 'ADD',
        content: prompt.split('## Candidate Information')[1]?.split('## Existing')[0]?.trim() || '',
        confidence: 0.7,
        reasoning: 'Novel information worth remembering',
      };
    }

    // If very similar entry exists, NOOP
    return {
      operation: 'NOOP',
      confidence: 0.6,
      reasoning: 'Similar information already exists',
    };
  }

  private logOperation(decision: MemoryManagerDecision, taskId: string): void {
    this.state.operationHistory.push({
      id: `op-${Date.now()}`,
      operation: decision.operation,
      entryId: decision.entryId || '',
      reason: decision.reasoning,
      timestamp: Date.now(),
      taskId,
    });

    // Keep history bounded
    if (this.state.operationHistory.length > 10000) {
      this.state.operationHistory = this.state.operationHistory.slice(-5000);
    }
  }

  // ============ Persistence ============

  async save(): Promise<MemoryR1Snapshot> {
    const snapshot: MemoryR1Snapshot = {
      version: '1.0',
      timestamp: Date.now(),
      entries: Array.from(this.state.entries.entries()),
      operationHistory: this.state.operationHistory.slice(-1000),
      retrievalHistory: this.state.retrievalHistory.slice(-1000),
    };

    this.emit('state:saved', snapshot);
    return snapshot;
  }

  async load(snapshot: MemoryR1Snapshot): Promise<void> {
    this.state.entries = new Map(snapshot.entries);
    this.state.operationHistory = snapshot.operationHistory;
    this.state.retrievalHistory = snapshot.retrievalHistory;
    this.state.totalEntries = this.state.entries.size;
    this.state.totalTokens = Array.from(this.state.entries.values()).reduce(
      (sum, e) => sum + this.estimateTokens(e.content),
      0
    );

    this.emit('state:loaded', snapshot);
  }

  // ============ Queries ============

  getEntry(entryId: string): MemoryEntry | undefined {
    return this.state.entries.get(entryId);
  }

  getAllEntries(): MemoryEntry[] {
    return Array.from(this.state.entries.values());
  }

  getStats(): MemoryR1Stats {
    const entries = Array.from(this.state.entries.values());
    const avgRelevance = entries.length > 0 ? entries.reduce((sum, e) => sum + e.relevanceScore, 0) / entries.length : 0;

    const operationCounts: Record<MemoryOperation, number> = {
      ADD: 0,
      UPDATE: 0,
      DELETE: 0,
      NOOP: 0,
    };
    for (const log of this.state.operationHistory) {
      operationCounts[log.operation]++;
    }

    const recentFetches = this.state.retrievalHistory.filter(
      r => Date.now() - r.timestamp < 3600000
    ).length;

    const totalFetches = this.state.retrievalHistory.length;
    const cacheHitRate =
      totalFetches > 0
        ? this.state.retrievalHistory.filter(r => r.retrievedIds.length > 0).length / totalFetches
        : 0;

    return {
      totalEntries: this.state.totalEntries,
      totalTokens: this.state.totalTokens,
      avgRelevanceScore: avgRelevance,
      operationCounts,
      recentRetrievals: recentFetches,
      cacheHitRate,
    };
  }
}

// Export singleton getter
export function getMemoryManager(): MemoryManagerAgent {
  return MemoryManagerAgent.getInstance();
}
