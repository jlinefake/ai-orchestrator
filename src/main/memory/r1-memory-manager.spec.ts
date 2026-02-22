import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MemoryEntry, MemoryR1Snapshot } from '../../shared/types/memory-r1.types';
import {
  getMemoryManager,
  MemoryManagerAgent,
} from './r1-memory-manager';

function createEntry(id: string, content: string): MemoryEntry {
  const now = Date.now();
  return {
    id,
    content,
    embedding: [0.1, 0.2, 0.3],
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
    sourceType: 'derived',
    sourceSessionId: 'session-1',
    relevanceScore: 0.5,
    confidenceScore: 0.8,
    linkedEntries: [],
    tags: ['test'],
    isArchived: false,
  };
}

describe('MemoryManagerAgent hardening', () => {
  let manager: MemoryManagerAgent;

  beforeEach(() => {
    MemoryManagerAgent._resetForTesting();
    manager = getMemoryManager();
    manager.configure({
      embeddingDimension: 8,
      similarityThreshold: 0,
    });
  });

  afterEach(() => {
    MemoryManagerAgent._resetForTesting();
  });

  it('enforces maxEntries by evicting older low-priority entries', async () => {
    manager.configure({ maxEntries: 3, maxTokens: 100_000 });

    for (let i = 0; i < 5; i++) {
      await manager.addEntry(`entry-${i}-content`, 'test');
    }

    expect(manager.getAllEntries().length).toBeLessThanOrEqual(3);
    expect(manager.getStats().totalEntries).toBeLessThanOrEqual(3);
  });

  it('bounds retrieval history growth', async () => {
    manager.configure({ maxEntries: 100, maxTokens: 100_000 });
    await manager.addEntry('seed retrieval entry', 'seed');

    for (let i = 0; i < 10_050; i++) {
      await manager.retrieve(`query-${i}`, `task-${i}`);
    }

    const retrievalHistoryLength = (manager as unknown as {
      state: { retrievalHistory: unknown[] };
    }).state.retrievalHistory.length;

    expect(retrievalHistoryLength).toBeLessThanOrEqual(5000);
  });

  it('rejects updates that exceed max token budget', async () => {
    manager.configure({ maxEntries: 10, maxTokens: 40 });
    const entry = await manager.addEntry('small value', 'seed');

    await expect(
      manager.executeOperation({
        operation: 'UPDATE',
        entryId: entry.id,
        content: 'x'.repeat(500),
        confidence: 1,
        reasoning: 'force oversize update',
      })
    ).rejects.toThrow(/exceeds maxTokens/i);

    expect(manager.getEntry(entry.id)?.content).toBe('small value');
  });

  it('enforces capacity limits when loading snapshots', async () => {
    manager.configure({ maxEntries: 2, maxTokens: 100_000 });

    const entries: [string, MemoryEntry][] = [
      ['mem-1', createEntry('mem-1', 'one')],
      ['mem-2', createEntry('mem-2', 'two')],
      ['mem-3', createEntry('mem-3', 'three')],
      ['mem-4', createEntry('mem-4', 'four')],
    ];

    const snapshot: MemoryR1Snapshot = {
      version: '1.0',
      timestamp: Date.now(),
      entries,
      operationHistory: [],
      retrievalHistory: [],
    };

    await manager.load(snapshot);

    expect(manager.getAllEntries().length).toBeLessThanOrEqual(2);
    expect(manager.getStats().totalEntries).toBeLessThanOrEqual(2);
  });
});
