/**
 * RLM Evaluation Harness
 * Lightweight benchmarking for retrieval accuracy, summary coverage, and token savings.
 */

import { RLMContextManager } from './context-manager';
import type { ContextQuery } from '../../shared/types/rlm.types';

export interface RetrievalBenchmarkCase {
  storeId: string;
  sessionId?: string;
  query: ContextQuery;
  expectedSectionIds?: string[];
  expectedKeywords?: string[];
}

export interface RetrievalBenchmarkResult {
  totalCases: number;
  hits: number;
  hitRate: number;
  averageLatencyMs: number;
}

export interface SummaryCoverageResult {
  storeId: string;
  summarySections: number;
  averageCompressionRatio: number;
  averageSummaryTokens: number;
}

export interface TokenSavingsResult {
  days: number;
  sessionsCount: number;
  averageSavingsPercent: number;
  totalDirectTokens: number;
  totalActualTokens: number;
}

export class RlmEvaluationHarness {
  constructor(private readonly rlm = RLMContextManager.getInstance()) {}

  async runRetrievalBenchmark(
    cases: RetrievalBenchmarkCase[]
  ): Promise<RetrievalBenchmarkResult> {
    let hits = 0;
    let totalDuration = 0;
    const sessionMap = new Map<string, string>();

    for (const testCase of cases) {
      const sessionId =
        testCase.sessionId ||
        (await this.ensureSession(testCase.storeId, sessionMap));
      const result = await this.rlm.executeQuery(sessionId, testCase.query);
      totalDuration += result.duration;

      const expectedIds = testCase.expectedSectionIds || [];
      const expectedKeywords = testCase.expectedKeywords || [];

      const matchedIds = expectedIds.some((id) =>
        result.sectionsAccessed.includes(id)
      );
      const matchedKeywords = expectedKeywords.some((keyword) =>
        result.result.toLowerCase().includes(keyword.toLowerCase())
      );

      if (matchedIds || matchedKeywords) {
        hits += 1;
      }
    }

    this.cleanupSessions(sessionMap);

    return {
      totalCases: cases.length,
      hits,
      hitRate: cases.length === 0 ? 0 : hits / cases.length,
      averageLatencyMs: cases.length === 0 ? 0 : totalDuration / cases.length
    };
  }

  evaluateSummaryCoverage(storeId: string): SummaryCoverageResult | null {
    const store = this.rlm.getStore(storeId);
    if (!store) return null;

    const summaries = store.sections.filter(
      (section) => section.depth > 0 || section.type === 'summary'
    );
    if (summaries.length === 0) {
      return {
        storeId,
        summarySections: 0,
        averageCompressionRatio: 0,
        averageSummaryTokens: 0
      };
    }

    let totalCompression = 0;
    let totalSummaryTokens = 0;

    for (const summary of summaries) {
      const summarizedIds = summary.summarizes || [];
      const summarizedTokens = store.sections
        .filter((section) => summarizedIds.includes(section.id))
        .reduce((sum, section) => sum + section.tokens, 0);

      const ratio =
        summarizedTokens > 0 ? summary.tokens / summarizedTokens : 0;
      totalCompression += ratio;
      totalSummaryTokens += summary.tokens;
    }

    return {
      storeId,
      summarySections: summaries.length,
      averageCompressionRatio: totalCompression / summaries.length,
      averageSummaryTokens: totalSummaryTokens / summaries.length
    };
  }

  evaluateTokenSavings(days = 30): TokenSavingsResult {
    const history = this.rlm.getTokenSavingsHistory(days);
    const totalDirectTokens = history.reduce(
      (sum, entry) => sum + entry.directTokens,
      0
    );
    const totalActualTokens = history.reduce(
      (sum, entry) => sum + entry.actualTokens,
      0
    );

    const averageSavingsPercent =
      totalDirectTokens === 0
        ? 0
        : Math.max(
            0,
            ((totalDirectTokens - totalActualTokens) / totalDirectTokens) * 100
          );

    return {
      days,
      sessionsCount: history.length,
      averageSavingsPercent,
      totalDirectTokens,
      totalActualTokens
    };
  }

  private async ensureSession(
    storeId: string,
    sessionMap: Map<string, string>
  ): Promise<string> {
    const existing = sessionMap.get(storeId);
    if (existing) return existing;

    const store = this.rlm.getStore(storeId);
    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    const session = await this.rlm.startSession(storeId, store.instanceId);
    sessionMap.set(storeId, session.id);
    return session.id;
  }

  private cleanupSessions(sessionMap: Map<string, string>): void {
    for (const sessionId of sessionMap.values()) {
      this.rlm.endSession(sessionId);
    }
  }
}
