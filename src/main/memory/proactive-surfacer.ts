/**
 * Proactive Surfacer - Surface relevant context BEFORE the user needs it
 * Phase 3 of Memory & Context Management Enhancement Plan
 *
 * Called when user opens a file or enters a directory.
 * Surfaces relevant memories before they ask:
 * - Procedural workflows matching the file context
 * - Episodic memories (past sessions with this file)
 * - Learned patterns that apply
 *
 * Features:
 * - 10-minute cooldown to avoid re-surfacing same context
 * - Integration with UnifiedMemoryController
 * - File watcher integration for automatic triggering
 * - Formatted suggestions with workflows and sessions
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import type {
  SessionMemory,
  WorkflowMemory,
  StrategyMemory,
  LearnedPattern,
} from '../../shared/types/unified-memory.types';

// ============ Types ============

export interface ProactiveSuggestion {
  type: 'proactive';
  message: string;
  relevantMemories: RelevantMemory[];
  filePath: string;
  timestamp: number;
}

export interface RelevantMemory {
  type: 'workflow' | 'session' | 'strategy' | 'pattern';
  id: string;
  name: string;
  summary: string;
  relevanceScore: number;
}

export interface ProactiveSurfacerConfig {
  /** Cooldown in milliseconds before re-surfacing same context (default: 10 minutes) */
  cooldownMs: number;
  /** Maximum number of workflows to include in suggestion */
  maxWorkflows: number;
  /** Maximum number of sessions to include in suggestion */
  maxSessions: number;
  /** Maximum number of strategies to include */
  maxStrategies: number;
  /** Maximum number of patterns to include */
  maxPatterns: number;
  /** Minimum relevance score to include in suggestion (0-1) */
  minRelevanceScore: number;
  /** Whether to include file extension context in matching */
  useFileExtensionContext: boolean;
  /** File extensions to watch for proactive surfacing */
  watchedExtensions: string[];
}

export interface ProactiveSurfacerStats {
  totalSurfacings: number;
  cacheHits: number;
  avgSurfacingTimeMs: number;
  lastSurfacingTimeMs: number;
  activeContexts: number;
}

export interface MemoryController {
  getWorkflows(): WorkflowMemory[];
  getStrategies(): StrategyMemory[];
  getSessionHistory(limit?: number): SessionMemory[];
  getPatterns(minSuccessRate?: number): LearnedPattern[];
}

// ============ Default Configuration ============

const DEFAULT_CONFIG: ProactiveSurfacerConfig = {
  cooldownMs: 10 * 60 * 1000, // 10 minutes
  maxWorkflows: 3,
  maxSessions: 3,
  maxStrategies: 2,
  maxPatterns: 2,
  minRelevanceScore: 0.3,
  useFileExtensionContext: true,
  watchedExtensions: [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
    '.cpp', '.c', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
    '.kt', '.scala', '.vue', '.svelte', '.astro', '.md', '.json',
    '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss',
  ],
};

// ============ File Context Utilities ============

/**
 * Extract meaningful context from a file path
 */
function extractFileContext(filePath: string): FileContext {
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const nameWithoutExt = path.basename(filePath, ext);

  // Extract meaningful parts from path
  const pathParts = filePath.split(path.sep).filter(Boolean);

  // Detect common patterns
  const isTest = /\.(spec|test|e2e)\.(ts|js|tsx|jsx)$/.test(basename) ||
    pathParts.includes('__tests__') ||
    pathParts.includes('test') ||
    pathParts.includes('tests');

  const isConfig = /^(\..*rc|.*config|tsconfig|package|angular|webpack|vite|rollup|jest|prettier|eslint)/.test(nameWithoutExt) ||
    ['.json', '.yaml', '.yml', '.toml'].includes(ext);

  const isComponent = pathParts.includes('components') ||
    pathParts.includes('views') ||
    pathParts.includes('pages') ||
    /component/i.test(nameWithoutExt);

  const isService = pathParts.includes('services') ||
    pathParts.includes('api') ||
    /service/i.test(nameWithoutExt);

  const isModel = pathParts.includes('models') ||
    pathParts.includes('entities') ||
    /model|entity/i.test(nameWithoutExt);

  const isUtil = pathParts.includes('utils') ||
    pathParts.includes('helpers') ||
    pathParts.includes('lib') ||
    /util|helper/i.test(nameWithoutExt);

  return {
    filePath,
    basename,
    dirname,
    extension: ext,
    nameWithoutExt,
    pathParts,
    isTest,
    isConfig,
    isComponent,
    isService,
    isModel,
    isUtil,
  };
}

interface FileContext {
  filePath: string;
  basename: string;
  dirname: string;
  extension: string;
  nameWithoutExt: string;
  pathParts: string[];
  isTest: boolean;
  isConfig: boolean;
  isComponent: boolean;
  isService: boolean;
  isModel: boolean;
  isUtil: boolean;
}

// ============ Proactive Surfacer Class ============

export class ProactiveSurfacer extends EventEmitter {
  private static instance: ProactiveSurfacer;
  private config: ProactiveSurfacerConfig;
  private memoryController: MemoryController | null = null;

  // Cache for recently surfaced contexts (key -> timestamp)
  private lastSurfacedContext: Map<string, number> = new Map();

  // Statistics
  private stats: ProactiveSurfacerStats = {
    totalSurfacings: 0,
    cacheHits: 0,
    avgSurfacingTimeMs: 0,
    lastSurfacingTimeMs: 0,
    activeContexts: 0,
  };

  // ============ Singleton ============

  static getInstance(config?: Partial<ProactiveSurfacerConfig>): ProactiveSurfacer {
    if (!this.instance) {
      this.instance = new ProactiveSurfacer(config);
    }
    return this.instance;
  }

  private constructor(config?: Partial<ProactiveSurfacerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ Configuration ============

  configure(config: Partial<ProactiveSurfacerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ProactiveSurfacerConfig {
    return { ...this.config };
  }

  // ============ Initialization ============

  /**
   * Initialize with a memory controller reference.
   * Call this at startup to enable proactive surfacing.
   */
  initialize(memoryController: MemoryController): void {
    this.memoryController = memoryController;
    this.emit('initialized', { config: this.config });
  }

  // ============ Core Surfacing Logic ============

  /**
   * Called when user opens a file or enters a directory.
   * Surfaces relevant memories before they ask.
   *
   * @param filePath - The file or directory path the user is working with
   * @returns ProactiveSuggestion if relevant context found, null otherwise
   */
  async onFileContextChange(filePath: string): Promise<ProactiveSuggestion | null> {
    const startTime = Date.now();

    if (!this.memoryController) {
      this.emit('error', { message: 'Memory controller not initialized' });
      return null;
    }

    // Check if file extension should be watched
    const ext = path.extname(filePath).toLowerCase();
    if (this.config.useFileExtensionContext && ext && !this.config.watchedExtensions.includes(ext)) {
      return null;
    }

    // Don't resurface same context within cooldown period
    const cacheKey = this.getContextKey(filePath);
    if (this.recentlySurfaced(cacheKey)) {
      this.stats.cacheHits++;
      this.emit('context:cached', { filePath, cacheKey });
      return null;
    }

    // Extract file context
    const fileContext = extractFileContext(filePath);

    // Find relevant procedural memories (workflows and strategies)
    const workflows = this.findRelevantWorkflows(fileContext);
    const strategies = this.findRelevantStrategies(fileContext);

    // Find relevant episodic memories (past sessions with this file)
    const sessions = this.findRelevantSessions(filePath);

    // Find relevant patterns
    const patterns = this.findRelevantPatterns(fileContext);

    // Combine and filter by relevance
    const relevantMemories: RelevantMemory[] = [
      ...workflows,
      ...strategies,
      ...sessions,
      ...patterns,
    ].filter(m => m.relevanceScore >= this.config.minRelevanceScore);

    // If nothing relevant, return null
    if (relevantMemories.length === 0) {
      return null;
    }

    // Mark as surfaced
    this.lastSurfacedContext.set(cacheKey, Date.now());
    this.stats.activeContexts = this.lastSurfacedContext.size;

    // Format suggestion
    const suggestion: ProactiveSuggestion = {
      type: 'proactive',
      message: this.formatSuggestion(workflows, strategies, sessions, patterns, filePath),
      relevantMemories,
      filePath,
      timestamp: Date.now(),
    };

    // Update stats
    const surfacingTime = Date.now() - startTime;
    this.stats.totalSurfacings++;
    this.stats.lastSurfacingTimeMs = surfacingTime;
    this.stats.avgSurfacingTimeMs =
      (this.stats.avgSurfacingTimeMs * (this.stats.totalSurfacings - 1) + surfacingTime) /
      this.stats.totalSurfacings;

    this.emit('context:surfaced', {
      filePath,
      workflowCount: workflows.length,
      sessionCount: sessions.length,
      strategyCount: strategies.length,
      patternCount: patterns.length,
      surfacingTimeMs: surfacingTime,
    });

    return suggestion;
  }

  /**
   * Called when user enters a directory.
   * Surfaces relevant memories for the directory context.
   */
  async onDirectoryContextChange(dirPath: string): Promise<ProactiveSuggestion | null> {
    // Use the same logic but with directory context
    return this.onFileContextChange(dirPath);
  }

  // ============ Memory Matching ============

  private findRelevantWorkflows(fileContext: FileContext): RelevantMemory[] {
    if (!this.memoryController) return [];

    const workflows = this.memoryController.getWorkflows();
    const relevant: RelevantMemory[] = [];

    for (const workflow of workflows) {
      const score = this.calculateWorkflowRelevance(workflow, fileContext);
      if (score > 0) {
        relevant.push({
          type: 'workflow',
          id: workflow.id,
          name: workflow.name,
          summary: workflow.steps.slice(0, 3).join(' -> ') + (workflow.steps.length > 3 ? '...' : ''),
          relevanceScore: score,
        });
      }
    }

    return relevant
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.maxWorkflows);
  }

  private findRelevantStrategies(fileContext: FileContext): RelevantMemory[] {
    if (!this.memoryController) return [];

    const strategies = this.memoryController.getStrategies();
    const relevant: RelevantMemory[] = [];

    for (const strategy of strategies) {
      const score = this.calculateStrategyRelevance(strategy, fileContext);
      if (score > 0) {
        relevant.push({
          type: 'strategy',
          id: strategy.id,
          name: strategy.strategy.slice(0, 50),
          summary: strategy.conditions.join(', '),
          relevanceScore: score,
        });
      }
    }

    return relevant
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.maxStrategies);
  }

  private findRelevantSessions(filePath: string): RelevantMemory[] {
    if (!this.memoryController) return [];

    const sessions = this.memoryController.getSessionHistory(20); // Check last 20 sessions
    const relevant: RelevantMemory[] = [];
    const filePathLower = filePath.toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    for (const session of sessions) {
      let score = 0;

      // Check if file path is mentioned in summary or key events
      const summaryLower = session.summary.toLowerCase();
      const keyEventsStr = session.keyEvents.join(' ').toLowerCase();

      if (summaryLower.includes(filePathLower) || keyEventsStr.includes(filePathLower)) {
        score = 0.9;
      } else if (summaryLower.includes(basename) || keyEventsStr.includes(basename)) {
        score = 0.7;
      } else {
        // Check for partial path matches
        const pathParts = filePath.split(path.sep).filter(Boolean);
        for (const part of pathParts) {
          if (part.length > 3 && (summaryLower.includes(part.toLowerCase()) || keyEventsStr.includes(part.toLowerCase()))) {
            score = Math.max(score, 0.4);
          }
        }
      }

      if (score > 0) {
        relevant.push({
          type: 'session',
          id: session.sessionId,
          name: `Session ${new Date(session.timestamp).toLocaleDateString()}`,
          summary: session.summary.slice(0, 100) + (session.summary.length > 100 ? '...' : ''),
          relevanceScore: score,
        });
      }
    }

    return relevant
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.maxSessions);
  }

  private findRelevantPatterns(fileContext: FileContext): RelevantMemory[] {
    if (!this.memoryController) return [];

    const patterns = this.memoryController.getPatterns(0.5); // Only patterns with >50% success
    const relevant: RelevantMemory[] = [];

    for (const pattern of patterns) {
      const score = this.calculatePatternRelevance(pattern, fileContext);
      if (score > 0) {
        relevant.push({
          type: 'pattern',
          id: pattern.id,
          name: pattern.pattern.slice(0, 50),
          summary: `Success: ${Math.round(pattern.successRate * 100)}%, Used: ${pattern.usageCount}x`,
          relevanceScore: score,
        });
      }
    }

    return relevant
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.maxPatterns);
  }

  // ============ Relevance Calculation ============

  private calculateWorkflowRelevance(workflow: WorkflowMemory, fileContext: FileContext): number {
    let score = 0;
    const nameLower = workflow.name.toLowerCase();
    const contextLower = fileContext.basename.toLowerCase();

    // Direct name match
    if (nameLower.includes(contextLower) || contextLower.includes(nameLower)) {
      score += 0.5;
    }

    // Context-based matching
    for (const ctx of workflow.applicableContexts) {
      const ctxLower = ctx.toLowerCase();

      // File type matching
      if (fileContext.isTest && ctxLower.includes('test')) score += 0.3;
      if (fileContext.isConfig && ctxLower.includes('config')) score += 0.3;
      if (fileContext.isComponent && ctxLower.includes('component')) score += 0.3;
      if (fileContext.isService && ctxLower.includes('service')) score += 0.3;
      if (fileContext.isModel && ctxLower.includes('model')) score += 0.3;
      if (fileContext.isUtil && ctxLower.includes('util')) score += 0.3;

      // Extension matching
      if (ctxLower.includes(fileContext.extension.replace('.', ''))) {
        score += 0.2;
      }

      // Path part matching
      for (const part of fileContext.pathParts) {
        if (ctxLower.includes(part.toLowerCase())) {
          score += 0.1;
        }
      }
    }

    // Weight by success rate
    score *= (0.5 + workflow.successRate * 0.5);

    return Math.min(score, 1);
  }

  private calculateStrategyRelevance(strategy: StrategyMemory, fileContext: FileContext): number {
    let score = 0;

    for (const condition of strategy.conditions) {
      const condLower = condition.toLowerCase();

      // File type matching
      if (fileContext.isTest && condLower.includes('test')) score += 0.3;
      if (fileContext.isConfig && condLower.includes('config')) score += 0.3;
      if (fileContext.isComponent && condLower.includes('component')) score += 0.3;
      if (fileContext.isService && condLower.includes('service')) score += 0.3;

      // Extension matching
      if (condLower.includes(fileContext.extension.replace('.', ''))) {
        score += 0.2;
      }

      // Path matching
      for (const part of fileContext.pathParts) {
        if (part.length > 3 && condLower.includes(part.toLowerCase())) {
          score += 0.1;
        }
      }
    }

    // Weight by outcomes success rate
    const outcomes = strategy.outcomes || [];
    if (outcomes.length > 0) {
      const successRate = outcomes.filter(o => o.success).length / outcomes.length;
      score *= (0.5 + successRate * 0.5);
    }

    return Math.min(score, 1);
  }

  private calculatePatternRelevance(pattern: LearnedPattern, fileContext: FileContext): number {
    let score = 0;
    const patternLower = pattern.pattern.toLowerCase();

    // Check if pattern mentions file type indicators
    if (fileContext.isTest && patternLower.includes('test')) score += 0.3;
    if (fileContext.isConfig && patternLower.includes('config')) score += 0.3;
    if (fileContext.isComponent && patternLower.includes('component')) score += 0.3;
    if (fileContext.isService && patternLower.includes('service')) score += 0.3;

    // Check pattern contexts
    for (const ctx of pattern.contexts) {
      const ctxLower = ctx.toLowerCase();
      for (const part of fileContext.pathParts) {
        if (part.length > 3 && ctxLower.includes(part.toLowerCase())) {
          score += 0.1;
        }
      }
    }

    // Weight by success rate and usage
    score *= (0.5 + pattern.successRate * 0.5);
    score *= Math.min(1, 0.5 + pattern.usageCount * 0.1);

    return Math.min(score, 1);
  }

  // ============ Cooldown Management ============

  /**
   * Get a unique cache key for a file context
   */
  private getContextKey(filePath: string): string {
    // Normalize path and use parent directory + filename for grouping
    const normalized = path.normalize(filePath);
    const parts = normalized.split(path.sep);

    // Use last 3 path components for uniqueness
    const key = parts.slice(-3).join('/');
    return key.toLowerCase();
  }

  /**
   * Check if this context was recently surfaced
   */
  private recentlySurfaced(cacheKey: string): boolean {
    const lastTime = this.lastSurfacedContext.get(cacheKey);
    if (!lastTime) return false;

    const elapsed = Date.now() - lastTime;
    return elapsed < this.config.cooldownMs;
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, timestamp] of this.lastSurfacedContext) {
      if (now - timestamp > this.config.cooldownMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.lastSurfacedContext.delete(key);
    }

    this.stats.activeContexts = this.lastSurfacedContext.size;
    this.emit('cache:cleaned', { removed: keysToDelete.length, remaining: this.stats.activeContexts });
  }

  /**
   * Force clear a specific context from cache (allow re-surfacing)
   */
  clearContext(filePath: string): boolean {
    const key = this.getContextKey(filePath);
    const deleted = this.lastSurfacedContext.delete(key);
    this.stats.activeContexts = this.lastSurfacedContext.size;
    return deleted;
  }

  /**
   * Clear all cached contexts
   */
  clearAllContexts(): void {
    this.lastSurfacedContext.clear();
    this.stats.activeContexts = 0;
    this.emit('cache:cleared');
  }

  // ============ Message Formatting ============

  /**
   * Format a user-friendly suggestion message
   */
  private formatSuggestion(
    workflows: RelevantMemory[],
    strategies: RelevantMemory[],
    sessions: RelevantMemory[],
    patterns: RelevantMemory[],
    filePath: string
  ): string {
    const parts: string[] = [];

    // Header
    const basename = path.basename(filePath);
    parts.push(`I notice you're working on ${basename}.`);

    // Workflows section
    if (workflows.length > 0) {
      parts.push('\nRelevant workflows:');
      for (const w of workflows) {
        parts.push(`  - ${w.name}: ${w.summary}`);
      }
    }

    // Strategies section
    if (strategies.length > 0) {
      parts.push('\nApplicable strategies:');
      for (const s of strategies) {
        parts.push(`  - ${s.name} (when: ${s.summary})`);
      }
    }

    // Sessions section
    if (sessions.length > 0) {
      parts.push('\nFrom previous sessions:');
      for (const s of sessions) {
        parts.push(`  - ${s.name}: ${s.summary}`);
      }
    }

    // Patterns section
    if (patterns.length > 0) {
      parts.push('\nLearned patterns:');
      for (const p of patterns) {
        parts.push(`  - ${p.name} (${p.summary})`);
      }
    }

    return parts.join('\n');
  }

  // ============ Statistics ============

  getStats(): ProactiveSurfacerStats {
    return { ...this.stats };
  }

  // ============ Cleanup ============

  clear(): void {
    this.lastSurfacedContext.clear();
    this.stats = {
      totalSurfacings: 0,
      cacheHits: 0,
      avgSurfacingTimeMs: 0,
      lastSurfacingTimeMs: 0,
      activeContexts: 0,
    };
  }

  /**
   * Reset for testing
   */
  static resetInstance(): void {
    ProactiveSurfacer.instance = undefined as unknown as ProactiveSurfacer;
  }
}

// ============ Singleton Accessor ============

export function getProactiveSurfacer(config?: Partial<ProactiveSurfacerConfig>): ProactiveSurfacer {
  return ProactiveSurfacer.getInstance(config);
}
