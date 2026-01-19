/**
 * RLM Context Manager
 * Based on arXiv:2512.24601 from MIT OASYS Lab
 *
 * Treats context as external environment for programmatic manipulation
 * Achieves 85%+ token savings vs direct context feeding
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  ContextStore,
  ContextSection,
  ContextQuery,
  ContextQueryResult,
  SearchIndex,
  SummaryIndex,
  RLMSession,
  RLMConfig,
  RecursiveCall,
  TermLocation,
  SummaryLevel,
  RLMStoreStats,
  RLMSessionStats,
} from '../../shared/types/rlm.types';

export class RLMContextManager extends EventEmitter {
  private static instance: RLMContextManager;
  private stores: Map<string, ContextStore> = new Map();
  private sessions: Map<string, RLMSession> = new Map();
  private config: RLMConfig;

  private defaultConfig: RLMConfig = {
    maxSectionTokens: 8000,
    summaryThreshold: 50000,
    searchWindowSize: 2000,
    maxRecursionDepth: 3,
    maxSubQueries: 10,
    subQueryTimeout: 30000,
    summaryTargetRatio: 0.2,
    enableCostTracking: true,
  };

  static getInstance(): RLMContextManager {
    if (!this.instance) {
      this.instance = new RLMContextManager();
    }
    return this.instance;
  }

  private constructor() {
    super();
    this.config = { ...this.defaultConfig };
  }

  configure(config: Partial<RLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RLMConfig {
    return { ...this.config };
  }

  // ============ Store Management ============

  createStore(instanceId: string): ContextStore {
    const store: ContextStore = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      instanceId,
      sections: [],
      totalTokens: 0,
      totalSize: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
    };

    this.stores.set(store.id, store);
    this.emit('store:created', store);
    return store;
  }

  addSection(
    storeId: string,
    type: ContextSection['type'],
    name: string,
    content: string,
    metadata?: Partial<ContextSection>
  ): ContextSection {
    const store = this.stores.get(storeId);
    if (!store) throw new Error(`Store not found: ${storeId}`);

    const tokens = this.estimateTokens(content);

    // Check if we need to split large sections
    if (tokens > this.config.maxSectionTokens) {
      return this.addLargeSection(store, type, name, content, metadata);
    }

    const section: ContextSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      content,
      tokens,
      startOffset: store.totalSize,
      endOffset: store.totalSize + content.length,
      checksum: this.computeChecksum(content),
      depth: 0,
      ...metadata,
    };

    store.sections.push(section);
    store.totalTokens += tokens;
    store.totalSize += content.length;

    // Rebuild search index incrementally
    this.updateSearchIndex(store, section);

    // Check if summarization needed
    if (store.totalTokens > this.config.summaryThreshold) {
      this.prepareSummaryLevel(store);
    }

    this.emit('section:added', { store, section });
    return section;
  }

  private addLargeSection(
    store: ContextStore,
    type: ContextSection['type'],
    name: string,
    content: string,
    metadata?: Partial<ContextSection>
  ): ContextSection {
    // Split by logical boundaries (paragraphs, code blocks, etc.)
    const chunks = this.splitContent(content);
    const sections: ContextSection[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkSection: ContextSection = {
        id: `sec-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
        type,
        name: `${name} (part ${i + 1}/${chunks.length})`,
        content: chunks[i],
        tokens: this.estimateTokens(chunks[i]),
        startOffset: store.totalSize,
        endOffset: store.totalSize + chunks[i].length,
        checksum: this.computeChecksum(chunks[i]),
        depth: 0,
        ...metadata,
      };

      store.sections.push(chunkSection);
      store.totalTokens += chunkSection.tokens;
      store.totalSize += chunks[i].length;
      this.updateSearchIndex(store, chunkSection);
      sections.push(chunkSection);
    }

    // Return first section as reference
    return sections[0];
  }

  private splitContent(content: string): string[] {
    const maxChunkTokens = this.config.maxSectionTokens;
    const chunks: string[] = [];

    // Try to split by double newlines (paragraphs)
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      const combined = currentChunk + (currentChunk ? '\n\n' : '') + para;
      if (this.estimateTokens(combined) > maxChunkTokens) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk = combined;
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    // If still too large, force split
    return chunks.flatMap(chunk => {
      if (this.estimateTokens(chunk) > maxChunkTokens) {
        return this.forceSplit(chunk, maxChunkTokens);
      }
      return [chunk];
    });
  }

  private forceSplit(content: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      const combined = currentChunk + (currentChunk ? '\n' : '') + line;
      if (this.estimateTokens(combined) > maxTokens) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk = combined;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  // ============ Query Engine (RLM Pattern) ============

  async startSession(storeId: string, instanceId: string): Promise<RLMSession> {
    const store = this.stores.get(storeId);
    if (!store) throw new Error(`Store not found: ${storeId}`);

    const session: RLMSession = {
      id: `rlm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      storeId,
      instanceId,
      queries: [],
      recursiveCalls: [],
      totalRootTokens: 0,
      totalSubQueryTokens: 0,
      estimatedDirectTokens: store.totalTokens,
      tokenSavingsPercent: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.emit('session:started', session);
    return session;
  }

  async executeQuery(
    sessionId: string,
    query: ContextQuery,
    depth: number = 0
  ): Promise<ContextQueryResult> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const store = this.stores.get(session.storeId);
    if (!store) throw new Error(`Store not found: ${session.storeId}`);

    store.lastAccessed = Date.now();
    store.accessCount++;
    session.lastActivityAt = Date.now();

    const startTime = Date.now();
    let result: string;
    let sectionsAccessed: string[] = [];
    let subQueries: ContextQueryResult[] = [];

    switch (query.type) {
      case 'grep':
        ({ result, sectionsAccessed } = this.executeGrep(
          store,
          query.params as { pattern: string; maxResults?: number }
        ));
        break;

      case 'slice':
        ({ result, sectionsAccessed } = this.executeSlice(
          store,
          query.params as { start: number; end: number }
        ));
        break;

      case 'get_section':
        ({ result, sectionsAccessed } = this.getSection(
          store,
          query.params as { sectionId: string }
        ));
        break;

      case 'summarize':
        result = await this.executeSummarize(
          session,
          store,
          query.params as { sectionIds: string[] }
        );
        sectionsAccessed = (query.params as { sectionIds: string[] }).sectionIds;
        break;

      case 'sub_query':
        const subResult = await this.executeSubQuery(
          session,
          store,
          query.params as { prompt: string; contextHints?: string[] },
          depth
        );
        result = subResult.result;
        sectionsAccessed = subResult.sectionsAccessed;
        subQueries = subResult.subQueries || [];
        break;

      case 'semantic_search':
        ({ result, sectionsAccessed } = await this.executeSemanticSearch(
          store,
          query.params as { query: string; topK?: number }
        ));
        break;

      default:
        throw new Error(`Unknown query type: ${query.type}`);
    }

    const tokensUsed = this.estimateTokens(result);
    const queryResult: ContextQueryResult = {
      query,
      result,
      tokensUsed,
      sectionsAccessed,
      duration: Date.now() - startTime,
      subQueries,
      depth,
    };

    // Track costs
    if (depth === 0) {
      session.totalRootTokens += tokensUsed;
    } else {
      session.totalSubQueryTokens += tokensUsed;
    }

    const totalUsed = session.totalRootTokens + session.totalSubQueryTokens;
    session.tokenSavingsPercent = Math.max(
      0,
      ((session.estimatedDirectTokens - totalUsed) / session.estimatedDirectTokens) * 100
    );

    session.queries.push(queryResult);
    this.emit('query:executed', { session, queryResult });

    return queryResult;
  }

  private executeGrep(
    store: ContextStore,
    params: { pattern: string; maxResults?: number }
  ): { result: string; sectionsAccessed: string[] } {
    const { pattern, maxResults = 10 } = params;
    const regex = new RegExp(pattern, 'gi');
    const matches: { section: ContextSection; match: RegExpMatchArray; context: string }[] = [];
    const sectionsAccessed: string[] = [];

    for (const section of store.sections) {
      if (section.depth > 0) continue; // Skip summaries

      const sectionMatches = [...section.content.matchAll(regex)];

      for (const match of sectionMatches) {
        if (matches.length >= maxResults) break;

        // Extract context around match
        const windowSize = this.config.searchWindowSize;
        const start = Math.max(0, match.index! - windowSize);
        const end = Math.min(section.content.length, match.index! + match[0].length + windowSize);
        const context = section.content.slice(start, end);

        matches.push({ section, match, context });
        if (!sectionsAccessed.includes(section.id)) {
          sectionsAccessed.push(section.id);
        }
      }

      if (matches.length >= maxResults) break;
    }

    const result = matches
      .map((m, i) => `[Match ${i + 1}] ${m.section.name} (${m.section.type}):\n...${m.context}...`)
      .join('\n\n---\n\n');

    return { result: result || 'No matches found.', sectionsAccessed };
  }

  private executeSlice(
    store: ContextStore,
    params: { start: number; end: number }
  ): { result: string; sectionsAccessed: string[] } {
    const { start, end } = params;
    const sectionsAccessed: string[] = [];
    let result = '';

    for (const section of store.sections) {
      if (section.depth > 0) continue;
      if (section.endOffset < start) continue;
      if (section.startOffset > end) break;

      const sliceStart = Math.max(0, start - section.startOffset);
      const sliceEnd = Math.min(section.content.length, end - section.startOffset);

      result += section.content.slice(sliceStart, sliceEnd);
      sectionsAccessed.push(section.id);
    }

    return { result, sectionsAccessed };
  }

  private getSection(
    store: ContextStore,
    params: { sectionId: string }
  ): { result: string; sectionsAccessed: string[] } {
    const section = store.sections.find(s => s.id === params.sectionId);
    if (!section) {
      return { result: `Section not found: ${params.sectionId}`, sectionsAccessed: [] };
    }

    return {
      result: `[${section.name}] (${section.tokens} tokens)\n\n${section.content}`,
      sectionsAccessed: [section.id],
    };
  }

  private async executeSummarize(
    session: RLMSession,
    store: ContextStore,
    params: { sectionIds: string[] }
  ): Promise<string> {
    const sections = store.sections.filter(s => params.sectionIds.includes(s.id));
    const content = sections.map(s => `## ${s.name}\n${s.content}`).join('\n\n---\n\n');

    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
    const targetTokens = Math.ceil(totalTokens * this.config.summaryTargetRatio);

    // Emit event for LLM to summarize
    return new Promise(resolve => {
      this.emit('summarize:request', {
        sessionId: session.id,
        content,
        targetTokens,
        callback: (summary: string) => {
          resolve(summary);
        },
      });

      // Fallback if not handled
      setTimeout(() => {
        resolve(
          `[Summary of ${sections.length} sections, ~${totalTokens} tokens → ~${targetTokens} target tokens]\n\nKey content from: ${sections.map(s => s.name).join(', ')}`
        );
      }, 5000);
    });
  }

  private async executeSubQuery(
    session: RLMSession,
    store: ContextStore,
    params: { prompt: string; contextHints?: string[] },
    depth: number
  ): Promise<{ result: string; sectionsAccessed: string[]; subQueries?: ContextQueryResult[] }> {
    if (depth >= this.config.maxRecursionDepth) {
      return {
        result: '[Max recursion depth reached. Please refine your query.]',
        sectionsAccessed: [],
      };
    }

    // Build context window from hints or use summaries
    let contextWindow = '';
    let sectionsAccessed: string[] = [];

    if (params.contextHints && params.contextHints.length > 0) {
      // Search for relevant context based on hints
      for (const hint of params.contextHints.slice(0, 3)) {
        const grepResult = this.executeGrep(store, { pattern: hint, maxResults: 3 });
        contextWindow += grepResult.result + '\n\n';
        sectionsAccessed.push(...grepResult.sectionsAccessed);
      }
    } else {
      // Use top-level summaries if available
      const summaries = store.sections.filter(s => s.type === 'summary' && s.depth === 1);
      if (summaries.length > 0) {
        contextWindow = summaries.map(s => s.content).join('\n\n---\n\n');
        sectionsAccessed = summaries.map(s => s.id);
      } else {
        // Fall back to section names overview
        const overview = store.sections
          .filter(s => s.depth === 0)
          .map(s => `- ${s.name} (${s.tokens} tokens, ${s.type})`)
          .join('\n');
        contextWindow = `Available sections:\n${overview}`;
      }
    }

    // Create recursive call record
    const recursiveCall: RecursiveCall = {
      id: `rc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      parentId:
        session.recursiveCalls.length > 0
          ? session.recursiveCalls[session.recursiveCalls.length - 1].id
          : undefined,
      depth: depth + 1,
      prompt: params.prompt,
      contextWindow: contextWindow.slice(0, 2000), // Store sample
      tokens: { input: 0, output: 0 },
      duration: 0,
      status: 'pending',
    };
    session.recursiveCalls.push(recursiveCall);

    // Emit event for recursive LLM call
    return new Promise(resolve => {
      recursiveCall.status = 'running';
      const startTime = Date.now();

      this.emit('sub_query:request', {
        sessionId: session.id,
        callId: recursiveCall.id,
        prompt: params.prompt,
        context: contextWindow,
        depth: depth + 1,
        callback: (response: string, tokens: { input: number; output: number }) => {
          recursiveCall.response = response;
          recursiveCall.tokens = tokens;
          recursiveCall.duration = Date.now() - startTime;
          recursiveCall.status = 'completed';

          session.totalSubQueryTokens += tokens.input + tokens.output;

          resolve({
            result: response,
            sectionsAccessed,
          });
        },
      });

      // Timeout handler
      setTimeout(() => {
        if (recursiveCall.status === 'running') {
          recursiveCall.status = 'failed';
          resolve({
            result: '[Sub-query timed out]',
            sectionsAccessed,
          });
        }
      }, this.config.subQueryTimeout);
    });
  }

  private async executeSemanticSearch(
    store: ContextStore,
    params: { query: string; topK?: number }
  ): Promise<{ result: string; sectionsAccessed: string[] }> {
    // Placeholder for embedding-based search
    // In production, integrate with vector store
    const { query, topK = 5 } = params;

    // Fall back to keyword search for now
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);
    const pattern = keywords.join('|');

    return this.executeGrep(store, { pattern, maxResults: topK });
  }

  // ============ Indexing ============

  private updateSearchIndex(store: ContextStore, section: ContextSection): void {
    if (!store.searchIndex) {
      store.searchIndex = {
        terms: new Map(),
        sectionBoundaries: [],
        lastRebuilt: Date.now(),
      };
    }

    // Simple word tokenization and indexing
    const words = section.content.toLowerCase().match(/\b\w{3,}\b/g) || [];
    let lineNumber = 1;
    let charIndex = 0;

    for (const word of words) {
      const locations = store.searchIndex.terms.get(word) || [];
      const nextIndex = section.content.indexOf(word, charIndex);

      if (nextIndex >= 0) {
        lineNumber += (section.content.slice(charIndex, nextIndex).match(/\n/g) || []).length;
        const location: TermLocation = {
          sectionId: section.id,
          offset: nextIndex,
          lineNumber,
        };
        locations.push(location);
        store.searchIndex.terms.set(word, locations);
        charIndex = nextIndex + word.length;
      }
    }

    store.searchIndex.sectionBoundaries.push(section.endOffset);
  }

  private prepareSummaryLevel(store: ContextStore): void {
    // Initialize summary index if needed
    if (!store.summaryIndex) {
      store.summaryIndex = {
        levels: [],
        sectionToSummary: new Map(),
      };
    }

    // Group original sections for potential summarization
    // (Actual summarization is lazy - done only when needed)
    const originalSections = store.sections.filter(s => s.depth === 0);
    const groupSize = 10;

    for (let i = 0; i < originalSections.length; i += groupSize) {
      const group = originalSections.slice(i, i + groupSize);
      const groupTokens = group.reduce((sum, s) => sum + s.tokens, 0);

      // Only create placeholder if group is large enough
      if (groupTokens > this.config.maxSectionTokens * 2) {
        const placeholder: ContextSection = {
          id: `summary-placeholder-${Date.now()}-${i}`,
          type: 'summary',
          name: `Summary: ${group[0].name} - ${group[group.length - 1].name}`,
          content: `[Pending summary of ${group.length} sections, ~${groupTokens} tokens]`,
          tokens: 100, // Placeholder estimate
          startOffset: 0,
          endOffset: 0,
          checksum: '',
          summarizes: group.map(s => s.id),
          depth: 1,
        };

        // Track in summary index
        const level: SummaryLevel = {
          depth: 1,
          sections: [placeholder],
          totalTokens: 100,
          compressionRatio: groupTokens / 100,
        };
        store.summaryIndex.levels.push(level);

        for (const s of group) {
          store.summaryIndex.sectionToSummary.set(s.id, placeholder.id);
        }
      }
    }
  }

  // ============ Utilities ============

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  private computeChecksum(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
  }

  // ============ Queries ============

  getStore(storeId: string): ContextStore | undefined {
    return this.stores.get(storeId);
  }

  getStoreByInstance(instanceId: string): ContextStore | undefined {
    return Array.from(this.stores.values()).find(s => s.instanceId === instanceId);
  }

  listStores(): ContextStore[] {
    return Array.from(this.stores.values());
  }

  getSession(sessionId: string): RLMSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): RLMSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionStats(sessionId: string): RLMSessionStats | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const avgDuration =
      session.queries.length > 0
        ? session.queries.reduce((sum, q) => sum + q.duration, 0) / session.queries.length
        : 0;

    return {
      totalQueries: session.queries.length,
      totalRecursiveCalls: session.recursiveCalls.length,
      rootTokens: session.totalRootTokens,
      subQueryTokens: session.totalSubQueryTokens,
      estimatedSavings: session.tokenSavingsPercent,
      avgQueryDuration: avgDuration,
    };
  }

  getStoreStats(storeId: string): RLMStoreStats | undefined {
    const store = this.stores.get(storeId);
    if (!store) return undefined;

    const originalSections = store.sections.filter(s => s.depth === 0).length;
    const summaries = store.sections.filter(s => s.depth > 0).length;
    const maxDepth = Math.max(0, ...store.sections.map(s => s.depth));

    return {
      sections: store.sections.length,
      originalSections,
      summaries,
      totalTokens: store.totalTokens,
      summaryLevels: maxDepth + 1,
      indexedTerms: store.searchIndex?.terms.size || 0,
    };
  }

  // ============ Cleanup ============

  deleteStore(storeId: string): void {
    this.stores.delete(storeId);
    // Also clean up related sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.storeId === storeId) {
        this.sessions.delete(sessionId);
      }
    }
    this.emit('store:deleted', { storeId });
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.emit('session:ended', session);
      this.sessions.delete(sessionId);
    }
  }

  // ============ Section Management ============

  listSections(storeId: string): ContextSection[] {
    const store = this.stores.get(storeId);
    if (!store) return [];
    return store.sections;
  }

  removeSection(storeId: string, sectionId: string): boolean {
    const store = this.stores.get(storeId);
    if (!store) return false;

    const index = store.sections.findIndex(s => s.id === sectionId);
    if (index === -1) return false;

    const section = store.sections[index];
    store.sections.splice(index, 1);
    store.totalTokens -= section.tokens;

    this.emit('section:removed', { store, section });
    return true;
  }
}
