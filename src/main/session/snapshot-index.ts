/**
 * SnapshotIndex
 *
 * In-memory index for fast snapshot lookups without disk I/O.
 * Tracks snapshot metadata keyed by id, with secondary index by sessionId.
 */

export interface SnapshotMeta {
  id: string;
  sessionId: string;
  timestamp: number;
  messageCount: number;
  schemaVersion: number;
}

export class SnapshotIndex {
  private byId = new Map<string, SnapshotMeta>();
  private bySession = new Map<string, Set<string>>();

  /**
   * Add or update a snapshot entry.
   */
  add(meta: SnapshotMeta): void {
    const existing = this.byId.get(meta.id);

    // If updating an entry that changed sessionId, remove from old session index.
    if (existing && existing.sessionId !== meta.sessionId) {
      this.removeFromSessionIndex(meta.id, existing.sessionId);
    }

    this.byId.set(meta.id, meta);

    let sessionSet = this.bySession.get(meta.sessionId);
    if (!sessionSet) {
      sessionSet = new Set<string>();
      this.bySession.set(meta.sessionId, sessionSet);
    }
    sessionSet.add(meta.id);
  }

  /**
   * Remove a snapshot entry by id.
   */
  remove(id: string): void {
    const meta = this.byId.get(id);
    if (!meta) return;

    this.removeFromSessionIndex(id, meta.sessionId);
    this.byId.delete(id);
  }

  /**
   * Get a single snapshot entry by id.
   */
  get(id: string): SnapshotMeta | undefined {
    return this.byId.get(id);
  }

  /**
   * List all snapshots for a session, sorted by timestamp descending (newest first).
   */
  listForSession(sessionId: string): SnapshotMeta[] {
    const ids = this.bySession.get(sessionId);
    if (!ids || ids.size === 0) return [];

    return Array.from(ids)
      .map(id => this.byId.get(id)!)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * List all snapshots across all sessions, sorted by timestamp descending.
   */
  listAll(): SnapshotMeta[] {
    return Array.from(this.byId.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Return snapshots with timestamp strictly less than cutoffTimestamp.
   * Sorted by timestamp descending.
   */
  getExpiredBefore(cutoffTimestamp: number): SnapshotMeta[] {
    return Array.from(this.byId.values())
      .filter(meta => meta.timestamp < cutoffTimestamp)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Return the excess snapshots for a session beyond maxCount.
   * The excess entries are the oldest ones (those beyond the maxCount newest).
   * Returns them sorted oldest-first (the ones that should be removed first).
   */
  getExcessForSession(sessionId: string, maxCount: number): SnapshotMeta[] {
    const sorted = this.listForSession(sessionId); // newest first
    if (sorted.length <= maxCount) return [];

    // Entries beyond the newest maxCount are excess; return oldest first.
    return sorted.slice(maxCount).reverse();
  }

  /**
   * Total number of snapshot entries in the index.
   */
  get size(): number {
    return this.byId.size;
  }

  private removeFromSessionIndex(id: string, sessionId: string): void {
    const sessionSet = this.bySession.get(sessionId);
    if (sessionSet) {
      sessionSet.delete(id);
      if (sessionSet.size === 0) {
        this.bySession.delete(sessionId);
      }
    }
  }
}
