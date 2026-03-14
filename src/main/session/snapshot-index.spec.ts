import { describe, it, expect, beforeEach } from 'vitest';
import { SnapshotIndex, SnapshotMeta } from './snapshot-index';

function makeMeta(overrides: Partial<SnapshotMeta> & { id: string; sessionId: string }): SnapshotMeta {
  return {
    timestamp: Date.now(),
    messageCount: 10,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('SnapshotIndex', () => {
  let index: SnapshotIndex;

  beforeEach(() => {
    index = new SnapshotIndex();
  });

  // -------------------------------------------------------------------------
  // Basic add / get
  // -------------------------------------------------------------------------

  it('returns undefined for a missing id', () => {
    expect(index.get('nonexistent')).toBeUndefined();
  });

  it('adds and retrieves a single entry', () => {
    const meta = makeMeta({ id: 'snap-1', sessionId: 'sess-a' });
    index.add(meta);
    expect(index.get('snap-1')).toEqual(meta);
  });

  it('size reflects current entry count', () => {
    expect(index.size).toBe(0);
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a' }));
    expect(index.size).toBe(1);
    index.add(makeMeta({ id: 'snap-2', sessionId: 'sess-a' }));
    expect(index.size).toBe(2);
  });

  it('adding the same id twice updates rather than duplicates', () => {
    const original = makeMeta({ id: 'snap-1', sessionId: 'sess-a', messageCount: 5 });
    const updated = makeMeta({ id: 'snap-1', sessionId: 'sess-a', messageCount: 20 });

    index.add(original);
    index.add(updated);

    expect(index.size).toBe(1);
    expect(index.get('snap-1')?.messageCount).toBe(20);
    expect(index.listForSession('sess-a')).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Remove
  // -------------------------------------------------------------------------

  it('remove deletes an entry and size decreases', () => {
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a' }));
    index.remove('snap-1');

    expect(index.get('snap-1')).toBeUndefined();
    expect(index.size).toBe(0);
  });

  it('remove on a nonexistent id is a no-op', () => {
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a' }));
    index.remove('nonexistent');
    expect(index.size).toBe(1);
  });

  it('removed entry no longer appears in listForSession', () => {
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a' }));
    index.add(makeMeta({ id: 'snap-2', sessionId: 'sess-a' }));
    index.remove('snap-1');

    const results = index.listForSession('sess-a');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('snap-2');
  });

  // -------------------------------------------------------------------------
  // listForSession
  // -------------------------------------------------------------------------

  it('listForSession returns empty array for unknown session', () => {
    expect(index.listForSession('unknown-session')).toEqual([]);
  });

  it('listForSession returns entries sorted by timestamp descending', () => {
    const t = 1_000_000;
    index.add(makeMeta({ id: 'snap-old', sessionId: 'sess-a', timestamp: t }));
    index.add(makeMeta({ id: 'snap-mid', sessionId: 'sess-a', timestamp: t + 1000 }));
    index.add(makeMeta({ id: 'snap-new', sessionId: 'sess-a', timestamp: t + 2000 }));

    const results = index.listForSession('sess-a');
    expect(results.map(r => r.id)).toEqual(['snap-new', 'snap-mid', 'snap-old']);
  });

  it('listForSession only returns entries for the requested session', () => {
    index.add(makeMeta({ id: 'snap-a', sessionId: 'sess-a' }));
    index.add(makeMeta({ id: 'snap-b', sessionId: 'sess-b' }));

    expect(index.listForSession('sess-a').map(r => r.id)).toEqual(['snap-a']);
    expect(index.listForSession('sess-b').map(r => r.id)).toEqual(['snap-b']);
  });

  // -------------------------------------------------------------------------
  // listAll
  // -------------------------------------------------------------------------

  it('listAll returns empty array on empty index', () => {
    expect(index.listAll()).toEqual([]);
  });

  it('listAll returns all entries across all sessions sorted by timestamp descending', () => {
    const t = 2_000_000;
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a', timestamp: t }));
    index.add(makeMeta({ id: 'snap-2', sessionId: 'sess-b', timestamp: t + 500 }));
    index.add(makeMeta({ id: 'snap-3', sessionId: 'sess-a', timestamp: t + 1000 }));

    const results = index.listAll();
    expect(results.map(r => r.id)).toEqual(['snap-3', 'snap-2', 'snap-1']);
  });

  // -------------------------------------------------------------------------
  // getExpiredBefore
  // -------------------------------------------------------------------------

  it('getExpiredBefore returns empty array on empty index', () => {
    expect(index.getExpiredBefore(Date.now())).toEqual([]);
  });

  it('getExpiredBefore filters to entries strictly older than the cutoff', () => {
    const cutoff = 1_000_000;
    const old1 = makeMeta({ id: 'old-1', sessionId: 'sess-a', timestamp: cutoff - 100 });
    const old2 = makeMeta({ id: 'old-2', sessionId: 'sess-a', timestamp: cutoff - 1 });
    const exact = makeMeta({ id: 'exact', sessionId: 'sess-a', timestamp: cutoff });      // not expired
    const fresh = makeMeta({ id: 'fresh', sessionId: 'sess-b', timestamp: cutoff + 500 }); // not expired

    index.add(old1);
    index.add(old2);
    index.add(exact);
    index.add(fresh);

    const expired = index.getExpiredBefore(cutoff);
    const expiredIds = expired.map(r => r.id);

    expect(expiredIds).toContain('old-1');
    expect(expiredIds).toContain('old-2');
    expect(expiredIds).not.toContain('exact');
    expect(expiredIds).not.toContain('fresh');
    expect(expired).toHaveLength(2);
  });

  it('getExpiredBefore returns results sorted by timestamp descending', () => {
    const cutoff = 5_000_000;
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a', timestamp: cutoff - 3000 }));
    index.add(makeMeta({ id: 'snap-2', sessionId: 'sess-a', timestamp: cutoff - 1000 }));
    index.add(makeMeta({ id: 'snap-3', sessionId: 'sess-a', timestamp: cutoff - 2000 }));

    const results = index.getExpiredBefore(cutoff);
    expect(results.map(r => r.id)).toEqual(['snap-2', 'snap-3', 'snap-1']);
  });

  // -------------------------------------------------------------------------
  // getExcessForSession
  // -------------------------------------------------------------------------

  it('getExcessForSession returns empty array on empty index', () => {
    expect(index.getExcessForSession('sess-a', 5)).toEqual([]);
  });

  it('getExcessForSession returns empty when count is within limit', () => {
    index.add(makeMeta({ id: 'snap-1', sessionId: 'sess-a', timestamp: 1000 }));
    index.add(makeMeta({ id: 'snap-2', sessionId: 'sess-a', timestamp: 2000 }));

    expect(index.getExcessForSession('sess-a', 3)).toEqual([]);
    expect(index.getExcessForSession('sess-a', 2)).toEqual([]);
  });

  it('getExcessForSession returns oldest entries that exceed the limit', () => {
    const t = 1_000_000;
    index.add(makeMeta({ id: 'snap-oldest', sessionId: 'sess-a', timestamp: t }));
    index.add(makeMeta({ id: 'snap-mid',    sessionId: 'sess-a', timestamp: t + 1000 }));
    index.add(makeMeta({ id: 'snap-newest', sessionId: 'sess-a', timestamp: t + 2000 }));

    // Keep 2, so oldest should be excess
    const excess = index.getExcessForSession('sess-a', 2);
    expect(excess.map(r => r.id)).toEqual(['snap-oldest']);
  });

  it('getExcessForSession does not include entries from other sessions', () => {
    const t = 3_000_000;
    index.add(makeMeta({ id: 'a-1', sessionId: 'sess-a', timestamp: t }));
    index.add(makeMeta({ id: 'a-2', sessionId: 'sess-a', timestamp: t + 1000 }));
    index.add(makeMeta({ id: 'b-1', sessionId: 'sess-b', timestamp: t + 2000 }));

    const excess = index.getExcessForSession('sess-a', 1);
    expect(excess.map(r => r.id)).toEqual(['a-1']);
  });

  it('getExcessForSession with maxCount 0 returns all entries oldest first', () => {
    const t = 100_000;
    index.add(makeMeta({ id: 'snap-a', sessionId: 'sess-a', timestamp: t + 200 }));
    index.add(makeMeta({ id: 'snap-b', sessionId: 'sess-a', timestamp: t + 100 }));
    index.add(makeMeta({ id: 'snap-c', sessionId: 'sess-a', timestamp: t }));

    const excess = index.getExcessForSession('sess-a', 0);
    expect(excess.map(r => r.id)).toEqual(['snap-c', 'snap-b', 'snap-a']);
  });

  // -------------------------------------------------------------------------
  // Edge cases: empty index
  // -------------------------------------------------------------------------

  it('all query methods return empty for a freshly created index', () => {
    expect(index.get('any')).toBeUndefined();
    expect(index.listForSession('any-session')).toEqual([]);
    expect(index.listAll()).toEqual([]);
    expect(index.getExpiredBefore(Date.now())).toEqual([]);
    expect(index.getExcessForSession('any-session', 5)).toEqual([]);
    expect(index.size).toBe(0);
  });
});
