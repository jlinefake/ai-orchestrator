/**
 * RLM Vectors Module
 *
 * Vector operations for semantic search.
 */

import type Database from 'better-sqlite3';
import type { VectorRow } from '../rlm-database.types';

/**
 * Add a vector embedding.
 */
export function addVector(
  db: Database.Database,
  vector: {
    id: string;
    storeId: string;
    sectionId: string;
    embedding: number[];
    contentPreview?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const embeddingBuffer = Buffer.from(new Float32Array(vector.embedding).buffer);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO vectors
      (id, store_id, section_id, embedding, dimensions, content_preview, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    vector.id,
    vector.storeId,
    vector.sectionId,
    embeddingBuffer,
    vector.embedding.length,
    vector.contentPreview || null,
    vector.metadata ? JSON.stringify(vector.metadata) : null,
    Date.now()
  );
}

/**
 * Get all vectors for a store.
 */
export function getVectors(db: Database.Database, storeId: string): VectorRow[] {
  const stmt = db.prepare(`SELECT * FROM vectors WHERE store_id = ?`);
  return stmt.all(storeId) as VectorRow[];
}

/**
 * Get a vector by section ID.
 */
export function getVectorBySectionId(db: Database.Database, sectionId: string): VectorRow | null {
  const stmt = db.prepare(`SELECT * FROM vectors WHERE section_id = ?`);
  return stmt.get(sectionId) as VectorRow | null;
}

/**
 * Delete a vector by section ID.
 */
export function deleteVector(db: Database.Database, sectionId: string): void {
  const stmt = db.prepare(`DELETE FROM vectors WHERE section_id = ?`);
  stmt.run(sectionId);
}

/**
 * Convert a buffer back to an embedding array.
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
}
